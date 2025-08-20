import { BadRequestException, NotFoundException } from '@nestjs/common';
import { isPhotoFlowEnabled } from './feature-flags';

export function ensurePhotoEnabledOr404() {
  if (!isPhotoFlowEnabled()) {
    throw new NotFoundException();
  }
}

export function rejectPhotoMetadataIfDisabled(dto: any) {
  if (!isPhotoFlowEnabled() && dto?.photoMetadata) {
    throw new BadRequestException('photo flow disabled');
  }
}