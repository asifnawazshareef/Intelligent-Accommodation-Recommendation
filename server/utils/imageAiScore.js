import fs from "fs";
import path from "path";

export const DUPLICATE_SCORE = 0.45;
export const LOW_CONFIDENCE_SCORE = 0.15;

const roundScore = (value) =>
  Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;

const readPngDimensions = (buffer) => {
  if (buffer.length < 24) {
    return null;
  }

  const signature = buffer.subarray(0, 8);
  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  if (!signature.equals(pngSignature)) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    format: "png",
  };
};

const readJpegDimensions = (buffer) => {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];

    if (marker === 0xd8 || marker === 0x01) {
      offset += 2;
      continue;
    }

    if (offset + 3 >= buffer.length) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);

    if (segmentLength < 2) {
      break;
    }

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame && offset + 8 < buffer.length) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
        format: "jpeg",
      };
    }

    offset += 2 + segmentLength;
  }

  return null;
};

const readWebpDimensions = (buffer) => {
  if (buffer.length < 30) {
    return null;
  }

  const riff = buffer.toString("ascii", 0, 4);
  const webp = buffer.toString("ascii", 8, 12);

  if (riff !== "RIFF" || webp !== "WEBP") {
    return null;
  }

  const chunkHeader = buffer.toString("ascii", 12, 16);

  if (chunkHeader === "VP8 ") {
    if (buffer.length < 30) {
      return null;
    }

    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
      format: "webp",
    };
  }

  if (chunkHeader === "VP8L") {
    if (buffer.length < 25) {
      return null;
    }

    const bits =
      buffer[21] | (buffer[22] << 8) | (buffer[23] << 16) | (buffer[24] << 24);

    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
      format: "webp",
    };
  }

  if (chunkHeader === "VP8X") {
    if (buffer.length < 30) {
      return null;
    }

    const width =
      1 +
      buffer[24] +
      (buffer[25] << 8) +
      (buffer[26] << 16);
    const height =
      1 +
      buffer[27] +
      (buffer[28] << 8) +
      (buffer[29] << 16);

    return {
      width,
      height,
      format: "webp",
    };
  }

  return null;
};

export const readImageMetadata = (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".png") {
    return readPngDimensions(buffer);
  }

  if (ext === ".jpg" || ext === ".jpeg") {
    return readJpegDimensions(buffer);
  }

  if (ext === ".webp") {
    return readWebpDimensions(buffer);
  }

  return (
    readJpegDimensions(buffer) ||
    readPngDimensions(buffer) ||
    readWebpDimensions(buffer)
  );
};

const scoreFromSignals = (metadata, fileSize, { isDuplicate = false } = {}) => {
  if (isDuplicate) {
    return DUPLICATE_SCORE;
  }

  if (!metadata?.width || !metadata?.height) {
    return LOW_CONFIDENCE_SCORE;
  }

  const { width, height } = metadata;
  const pixels = width * height;
  const longestSide = Math.max(width, height);

  let resolutionScore = 0.25;
  if (longestSide >= 1920) {
    resolutionScore = 1;
  } else if (longestSide >= 1280) {
    resolutionScore = 0.88;
  } else if (longestSide >= 800) {
    resolutionScore = 0.74;
  } else if (longestSide >= 480) {
    resolutionScore = 0.58;
  } else if (longestSide >= 320) {
    resolutionScore = 0.42;
  }

  const megapixels = pixels / 1_000_000;
  if (megapixels < 0.05) {
    resolutionScore *= 0.45;
  } else if (megapixels < 0.12) {
    resolutionScore *= 0.72;
  }

  let compressionScore = 0.68;
  if (pixels > 0) {
    const bytesPerPixel = fileSize / pixels;
    if (bytesPerPixel >= 0.08 && bytesPerPixel <= 0.45) {
      compressionScore = 0.94;
    } else if (bytesPerPixel >= 0.04 && bytesPerPixel < 0.08) {
      compressionScore = 0.72;
    } else if (bytesPerPixel < 0.04) {
      compressionScore = 0.46;
    } else if (bytesPerPixel <= 0.85) {
      compressionScore = 0.86;
    } else {
      compressionScore = 0.78;
    }
  }

  const aspectRatio = width / height;
  let aspectScore = 1;
  if (aspectRatio < 0.35 || aspectRatio > 2.8) {
    aspectScore = 0.55;
  }
  if (aspectRatio < 0.25 || aspectRatio > 4) {
    aspectScore = 0.35;
  }

  let fileSizeScore = 1;
  if (fileSize < 15_000) {
    fileSizeScore = 0.38;
  } else if (fileSize < 40_000) {
    fileSizeScore = 0.62;
  } else if (fileSize > 4_800_000) {
    fileSizeScore = 0.82;
  }

  const weighted =
    resolutionScore * 0.42 +
    compressionScore * 0.28 +
    aspectScore * 0.15 +
    fileSizeScore * 0.15;

  return roundScore(weighted);
};

export const computeImageAiScore = (filePath, options = {}) => {
  if (options.isDuplicate) {
    return DUPLICATE_SCORE;
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return LOW_CONFIDENCE_SCORE;
  }

  try {
    const stats = fs.statSync(filePath);
    const metadata = readImageMetadata(filePath);
    return scoreFromSignals(metadata, stats.size, options);
  } catch {
    return LOW_CONFIDENCE_SCORE;
  }
};

export const shouldRecalculateAiScore = (image) =>
  image?.verificationStatus === "pending" &&
  (image.aiScore === 0 || image.aiScore === null || image.aiScore === undefined);
