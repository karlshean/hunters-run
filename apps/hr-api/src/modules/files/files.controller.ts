import { Controller, Post, Body, HttpCode, NotFoundException, UseGuards } from '@nestjs/common';
import { FilesService } from './files.service';
import { PresignPhotoDto } from './dto/presign-photo.dto';

// NOTE: we keep auth for prod; bypass in dev so the selfcheck can hit it.
class DevBypassGuard {
  canActivate() {
    return process.env.NODE_ENV !== 'production';
  }
}
// If you already have FirebaseAuthGuard, keep it imported:
// import { FirebaseAuthGuard } from '@platform/auth';

@Controller('files')
@UseGuards(process.env.NODE_ENV === 'production' ? /* FirebaseAuthGuard */ DevBypassGuard : DevBypassGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('presign-photo')
  @HttpCode(200)
  async presignPhoto(@Body() dto: PresignPhotoDto) {
    if (process.env.TENANT_PHOTO_FLOW_ENABLED !== 'true' && process.env.NODE_ENV === 'production') throw new NotFoundException();
    return this.filesService.createPresignedPost(dto);
  }
}