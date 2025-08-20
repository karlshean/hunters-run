import { Controller, Get } from '@nestjs/common';
import { isPhotoFlowEnabled } from '../common/feature-flags';

@Controller('flags')
export class FlagsController {
  @Get()
  getFlags() {
    return {
      photoFlowEnabled: isPhotoFlowEnabled()
    };
  }
}