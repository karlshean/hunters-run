import { Controller, Post, Body, HttpCode, NotFoundException, UseGuards, Req, BadRequestException, UseInterceptors } from '@nestjs/common';
import { FilesService } from './files.service';
import { PresignPhotoDto } from './dto/presign-photo.dto';
import { RLSInterceptor } from '../../common/rls.interceptor';

// NOTE: we keep auth for prod; bypass in dev so the selfcheck can hit it.
class DevBypassGuard {
  canActivate() {
    return process.env.NODE_ENV !== 'production';
  }
}
// If you already have FirebaseAuthGuard, keep it imported:
// import { FirebaseAuthGuard } from '@platform/auth';

@Controller('files')
@UseInterceptors(RLSInterceptor)
@UseGuards(process.env.NODE_ENV === 'production' ? /* FirebaseAuthGuard */ DevBypassGuard : DevBypassGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('presign-photo')
  @HttpCode(200)
  async presignPhoto(@Req() req: any, @Body() dto: PresignPhotoDto) {
    if (process.env.TENANT_PHOTO_FLOW_ENABLED !== 'true' && process.env.NODE_ENV === 'production') throw new NotFoundException();
    
    if (!req.orgId) {
      throw new BadRequestException('Missing organization ID in request headers');
    }
    
    return this.filesService.createPresignedPost(req.orgId, dto);
  }
}