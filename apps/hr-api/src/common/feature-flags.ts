export const isPhotoFlowEnabled = () => {
  const v = process.env.TENANT_PHOTO_FLOW_ENABLED?.toLowerCase() ?? 'false';
  return v === '1' || v === 'true' || v === 'yes';
};