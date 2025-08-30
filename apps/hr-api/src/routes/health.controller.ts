import { Controller, Get, Req } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AppDataSource } from "@platform/db/src/datasource";
import { StandardResponseDto } from "../dto/common.dto";
import { MonitoringMiddleware } from "../middleware/monitoring.middleware";

@ApiTags('Health & Monitoring')
@Controller('api')
export class HealthController {
  @Get("health")
  @ApiOperation({ 
    summary: 'Basic health check', 
    description: 'Returns service status without dependencies'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        service: { type: 'string', example: 'hr-api' },
        timestamp: { type: 'string', example: '2025-01-20T10:30:00.000Z' },
        version: { type: 'string', example: '1.0.0' }
      }
    }
  })
  health() { 
    return { 
      success: true, 
      service: "hr-api",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    }; 
  }

  @Get("ready")
  @ApiOperation({ 
    summary: 'Readiness probe with dependencies', 
    description: 'Checks database and Redis connectivity for K8s readiness'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'All dependencies are ready',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        db: { type: 'boolean', example: true },
        redis: { type: 'boolean', example: true },
        timestamp: { type: 'string', example: '2025-01-20T10:30:00.000Z' }
      }
    }
  })
  @ApiResponse({ 
    status: 503, 
    description: 'One or more dependencies failed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        db: { type: 'boolean', example: false },
        redis: { type: 'boolean', example: true },
        error: { type: 'string', example: 'db_failed' },
        timestamp: { type: 'string', example: '2025-01-20T10:30:00.000Z' }
      }
    }
  })
  async ready(@Req() req: any) {
    const timestamp = new Date().toISOString();
    
    try { 
      await AppDataSource.query("SELECT 1"); 
    } catch { 
      return { 
        success: false, 
        db: false, 
        redis: false, 
        error: "db_failed",
        timestamp 
      }; 
    }
    
    try { 
      await req.app.locals.redis.ping(); 
    } catch { 
      return { 
        success: false, 
        db: true, 
        redis: false, 
        error: "redis_failed",
        timestamp 
      }; 
    }
    
    return { 
      success: true, 
      db: true, 
      redis: true,
      timestamp 
    };
  }

  @Get("metrics")
  @ApiOperation({ 
    summary: 'System metrics and security status', 
    description: 'Database connectivity, effective user, RLS status (no secrets exposed)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'System metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        metrics: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                connected: { type: 'boolean', example: true },
                current_user: { type: 'string', example: 'app_user' },
                session_user: { type: 'string', example: 'app_user' },
                bypass_rls: { type: 'boolean', example: false },
                is_superuser: { type: 'boolean', example: false }
              }
            },
            rls_status: {
              type: 'object',
              properties: {
                properties_table_rls: { type: 'boolean', example: true },
                work_orders_table_rls: { type: 'boolean', example: true },
                policies_count: { type: 'number', example: 5 }
              }
            },
            runtime: {
              type: 'object',
              properties: {
                node_version: { type: 'string', example: 'v22.18.0' },
                uptime_seconds: { type: 'number', example: 3600 },
                memory_usage_mb: { type: 'number', example: 128 }
              }
            }
          }
        },
        timestamp: { type: 'string', example: '2025-01-20T10:30:00.000Z' }
      }
    }
  })
  async metrics() {
    const timestamp = new Date().toISOString();
    let dbMetrics: any = { connected: false };
    let rlsMetrics: any = {};
    
    try {
      // Check database identity and privileges (no secrets)
      const identityResult = await AppDataSource.query(`
        SELECT 
          current_user,
          session_user,
          current_setting('is_superuser') as is_superuser
      `);
      
      const privilegeResult = await AppDataSource.query(`
        SELECT rolsuper, rolbypassrls 
        FROM pg_roles 
        WHERE rolname = current_user
      `);
      
      dbMetrics = {
        connected: true,
        current_user: identityResult[0].current_user,
        session_user: identityResult[0].session_user,
        is_superuser: identityResult[0].is_superuser === 'on',
        bypass_rls: privilegeResult[0].rolbypassrls
      };
      
      // Check RLS status on key tables
      const rlsStatusResult = await AppDataSource.query(`
        SELECT 
          schemaname,
          tablename,
          rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'hr' 
        AND tablename IN ('properties', 'work_orders')
        ORDER BY tablename
      `);
      
      const policiesResult = await AppDataSource.query(`
        SELECT COUNT(*) as count 
        FROM pg_policies 
        WHERE schemaname = 'hr'
      `);
      
      rlsMetrics = {
        properties_table_rls: rlsStatusResult.find((r: any) => r.tablename === 'properties')?.rowsecurity || false,
        work_orders_table_rls: rlsStatusResult.find((r: any) => r.tablename === 'work_orders')?.rowsecurity || false,
        policies_count: parseInt(policiesResult[0].count)
      };
      
    } catch (error: any) {
      console.error('Metrics collection failed:', error.message);
      dbMetrics = { connected: false, error: 'query_failed' } as any;
    }
    
    // Runtime metrics (no secrets)
    const runtimeMetrics = {
      node_version: process.version,
      uptime_seconds: Math.floor(process.uptime()),
      memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      env_mode: process.env.NODE_ENV || 'unknown'
    };
    
    // HTTP performance metrics
    const httpMetrics = MonitoringMiddleware.getMetrics();
    
    return {
      success: true,
      metrics: {
        database: dbMetrics,
        rls_status: rlsMetrics,
        runtime: runtimeMetrics,
        http_performance: httpMetrics
      },
      timestamp
    };
  }
}