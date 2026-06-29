export const summarizeImageVerification = (images = []) => {
  const summary = {
    total: images?.length || 0,
    pending: 0,
    verified: 0,
    suspicious: 0,
    rejected: 0,
  };

  (images || []).forEach((image) => {
    if (summary[image.verificationStatus] !== undefined) {
      summary[image.verificationStatus] += 1;
    }
  });

  return summary;
};

export const hasVerifiedImage = (images = []) =>
  summarizeImageVerification(images).verified > 0;

export const hasUnverifiedImages = (images = []) => {
  const summary = summarizeImageVerification(images);
  return summary.pending > 0 || summary.suspicious > 0;
};

export const getVerifiedImages = (images = []) =>
  (images || []).filter((image) => image.verificationStatus === "verified");

export const getGuestDisplayImages = (images = [], { isPrivileged = false } = {}) => {
  if (isPrivileged) {
    return images || [];
  }

  return getVerifiedImages(images);
};
