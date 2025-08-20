import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { FilesService } from './files.service';
import { PresignPhotoDto } from './dto/presign-photo.dto';
import { ensurePhotoEnabledOr404 } from '../../common/photo-guards';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('presign-photo')
  async presignPhoto(
    @Headers('x-org-id') orgId: string,
    @Body() dto: PresignPhotoDto,
  ) {
    ensurePhotoEnabledOr404();
    
    if (!orgId) {
      throw new BadRequestException('Organization ID is required');
    }

    try {
      const result = await this.filesService.presignPhoto(orgId, dto);
      return {
        presignedPost: {
          url: result.url,
          fields: result.fields
        },
        s3Key: result.s3Key,
        expires: result.expires.toISOString()
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to generate presigned URL'
      );
    }
  }
}