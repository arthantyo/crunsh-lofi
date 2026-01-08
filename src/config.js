export default {
  // Video settings
  DEFAULT_DURATION: 3600, // 1 hour in seconds
  DEFAULT_VIDEO_SIZE: "1920x1080",
  DEFAULT_AUDIO_BITRATE: "192k",

  // YouTube settings
  YOUTUBE_CATEGORY_MUSIC: "10",
  DEFAULT_PRIVACY: "private", // Start private, publish manually

  // Default tags
  DEFAULT_TAGS: [
    "lofi",
    "lofi hip hop",
    "study music",
    "chill beats",
    "relaxing music",
    "focus music",
    "lofi beats",
    "study beats",
  ],

  // Audio styles
  AUDIO_STYLES: {
    CHILL: "lofi-chill",
    JAZZ: "lofi-jazz",
    AMBIENT: "lofi-ambient",
    UPBEAT: "lofi-upbeat",
  },

  // File paths
  PATHS: {
    TEMP: "./temp",
    OUTPUT: "./output",
    BACKGROUNDS: "./backgrounds",
  },

  // Validation rules
  VALIDATION: {
    MIN_CHAPTERS: 3,
    MIN_CHAPTER_LENGTH: 10, // seconds
    FIRST_CHAPTER_TIME: "0:00",
    MAX_VIDEO_SIZE: 128 * 1024 * 1024 * 1024, // 128 GB (YouTube limit)
    MAX_VIDEO_LENGTH: 12 * 60 * 60, // 12 hours
  },
};
