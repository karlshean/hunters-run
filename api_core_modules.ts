// apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security
  app.use(helmet());
  app.use(compression());
  
  // CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGIN', 'http://localhost:3001'),
    credentials: true,
  });

  // Global pipes and filters
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // API Documentation
  const config = new DocumentBuilder()
    .setTitle('Hunters Run Property Management API')
    .setDescription('Enterprise property management platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = configService.get('PORT', 3000);
  await app.listen(port);
  
  console.log(`🚀 API running on http://localhost:${port}`);
  console.log(`📚 Documentation: http://localhost:${port}/api`);
}

bootstrap();

// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { PlatformModule } from './modules/platform/platform.module';
import { HuntersRunModule } from './modules/hunters-run/hunters-run.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    DatabaseModule,
    AuthModule,
    PlatformModule,
    HuntersRunModule,
  ],
})
export class AppModule {}

// apps/api/src/database/database.module.ts
import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/../migrations/*{.ts,.js}'],
        synchronize: false,
        logging: configService.get('NODE_ENV') === 'development',
        ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: 'RLS_CONTEXT',
      useFactory: (dataSource: DataSource) => {
        return {
          async setContext(organizationId: string, userId?: string) {
            await dataSource.query(`SET LOCAL app.current_org = $1`, [organizationId]);
            if (userId) {
              await dataSource.query(`SET LOCAL app.current_user = $1`, [userId]);
            }
          },
          async clearContext() {
            await dataSource.query(`RESET app.current_org`);
            await dataSource.query(`RESET app.current_user`);
          },
        };
      },
      inject: [DataSource],
    },
  ],
  exports: ['RLS_CONTEXT'],
})
export class DatabaseModule {}

// apps/api/src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { FirebaseStrategy } from './strategies/firebase.strategy';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    FirebaseStrategy,
    AuthGuard,
    RolesGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService, AuthGuard, RolesGuard],
})
export class AuthModule {}

// apps/api/src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FirebaseAuthAdapter } from '@hunters-run/integrations';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../modules/platform/users/entities/user.entity';
import { Membership } from '../modules/platform/memberships/entities/membership.entity';

@Injectable()
export class AuthService {
  private firebaseAuth: FirebaseAuthAdapter;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Membership)
    private membershipsRepository: Repository<Membership>,
  ) {
    this.firebaseAuth = new FirebaseAuthAdapter(
      configService.get('FIREBASE_PROJECT_ID')!,
      configService.get('FIREBASE_PRIVATE_KEY')!,
      configService.get('FIREBASE_CLIENT_EMAIL')!,
    );
  }

  async validateFirebaseToken(token: string): Promise<any> {
    const result = await this.firebaseAuth.verifyToken(token);
    
    if (!result.success) {
      throw new UnauthorizedException('Invalid token');
    }

    // Find or create user
    let user = await this.usersRepository.findOne({
      where: { email: result.email },
    });

    if (!user) {
      user = this.usersRepository.create({
        email: result.email!,
        full_name: result.custom_claims?.name,
        email_verified_at: result.email_verified ? new Date() : null,
      });
      await this.usersRepository.save(user);
    }

    // Get user memberships with roles
    const memberships = await this.membershipsRepository.find({
      where: { user_id: user.id, status: 'active' },
      relations: ['organization', 'role'],
    });

    return {
      user,
      memberships,
      firebaseUid: result.uid,
    };
  }

  async generateTokens(user: User, memberships: Membership[]): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    const payload = {
      sub: user.id,
      email: user.email,
      orgs: memberships.map(m => ({
        org_id: m.organization_id,
        product_key: m.product_key,
        role_key: m.role.key,
      })),
    };

    const access_token = this.jwtService.sign(payload);
    const refresh_token = this.jwtService.sign(
      { sub: user.id },
      { expiresIn: '30d' }
    );

    return { access_token, refresh_token };
  }
}

// apps/api/src/auth/guards/auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @Inject('RLS_CONTEXT') private rlsContext: any,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request['user'] = payload;

      // Set RLS context if organization header present
      const orgId = request.headers['x-org-id'] as string;
      if (orgId) {
        await this.rlsContext.setContext(orgId, payload.sub);
        request['organizationId'] = orgId;
      }

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

// apps/api/src/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orgId = request.organizationId;

    if (!user || !orgId) {
      throw new ForbiddenException('Missing user or organization context');
    }

    // Check if user has required role for this organization
    const userOrg = user.orgs?.find((org: any) => org.org_id === orgId);
    
    if (!userOrg) {
      throw new ForbiddenException('User not member of this organization');
    }

    const hasRole = requiredRoles.some(role => userOrg.role_key === role);
    
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

// apps/api/src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// apps/api/src/common/filters/global-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = uuidv4();

    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : 'Internal server error';

    // Log error with context
    console.error({
      traceId,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      orgId: request.headers['x-org-id'],
      userId: request['user']?.sub,
      error: exception instanceof Error ? exception.stack : exception,
    });

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof message === 'string' ? message : (message as any).message,
      traceId,
    });
  }
}

// apps/api/src/common/interceptors/logging.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const delay = Date.now() - now;
        
        console.log({
          method,
          url,
          statusCode: response.statusCode,
          delay: `${delay}ms`,
          orgId: request.headers['x-org-id'],
          userId: request['user']?.sub,
        });
      }),
    );
  }
}

// apps/api/src/modules/platform/platform.module.ts
import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { FilesModule } from './files/files.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    UsersModule,
    OrganizationsModule,
    FilesModule,
    AuditModule,
  ],
})
export class PlatformModule {}

// apps/api/src/modules/hunters-run/hunters-run.module.ts
import { Module } from '@nestjs/common';
import { PropertiesModule } from './properties/properties.module';
import { UnitsModule } from './units/units.module';
import { TenantsModule } from './tenants/tenants.module';
import { LeasesModule } from './leases/leases.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { PaymentsModule } from './payments/payments.module';
import { LegalModule } from './legal/legal.module';

@Module({
  imports: [
    PropertiesModule,
    UnitsModule,
    TenantsModule,
    LeasesModule,
    MaintenanceModule,
    PaymentsModule,
    LegalModule,
  ],
})
export class HuntersRunModule {}