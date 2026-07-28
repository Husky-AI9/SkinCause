export type SafeProviderFailure = {
  code: string;
  message: string;
  retryable: boolean;
};

const knownFailures: Record<string, SafeProviderFailure> = {
  IMAGE_TOO_SMALL: {
    code: "IMAGE_TOO_SMALL",
    message: "Choose a larger image or retake closer to the camera.",
    retryable: true
  },
  IMAGE_DIMENSIONS_INVALID: {
    code: "IMAGE_INVALID",
    message: "The image dimensions could not be verified. Choose another JPG or PNG.",
    retryable: true
  },
  error_below_min_image_size: {
    code: "IMAGE_TOO_SMALL",
    message: "Choose a larger image or retake closer to the camera.",
    retryable: true
  },
  error_src_face_too_small: {
    code: "FACE_TOO_SMALL",
    message: "Move closer so your face fills most of the guide.",
    retryable: true
  },
  error_src_face_out_of_bound: {
    code: "FACE_OUT_OF_FRAME",
    message: "Keep your full face inside the guide and retake the image.",
    retryable: true
  },
  error_lighting_dark: {
    code: "IMAGE_TOO_DARK",
    message: "Move to brighter, even front lighting and retake the image.",
    retryable: true
  }
};

export function safeProviderFailure(code: string | undefined): SafeProviderFailure {
  if (code && knownFailures[code]) return knownFailures[code];
  if (code === "PROVIDER_RATE_LIMIT" || code === "RateLimitExceeded") {
    return {
      code: "PROVIDER_RATE_LIMIT",
      message: "Analysis is busy. Wait a moment before retrying.",
      retryable: true
    };
  }
  if (code?.includes("SCHEMA")) {
    return {
      code: "PROVIDER_SCHEMA_CHANGED",
      message: "The analysis response format changed unexpectedly.",
      retryable: false
    };
  }
  return {
    code: code?.startsWith("PROVIDER_") ? code : "PROVIDER_ERROR",
    message: "Analysis is temporarily unavailable.",
    retryable: true
  };
}
