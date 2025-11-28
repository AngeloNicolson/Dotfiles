// Firefox Performance Optimizations for YouTube and memory leaks

// Enable hardware video decoding (use GPU instead of CPU for videos)
user_pref("media.hardware-video-decoding.enabled", true);
user_pref("media.hardware-video-decoding.force-enabled", true);

// Disable AV1 codec (forces H.264 which has better NVIDIA hardware support)
user_pref("media.av1.enabled", false);

// Enable VAAPI for NVIDIA
user_pref("media.ffmpeg.vaapi.enabled", true);

// Enable WebRender (better GPU acceleration)
user_pref("gfx.webrender.all", true);

// Reduce memory usage
user_pref("browser.cache.memory.capacity", 51200); // 50MB instead of default
user_pref("browser.cache.memory.max_entry_size", 5120); // 5MB max per entry
user_pref("browser.sessionhistory.max_total_viewers", 2); // Reduce back/forward cache

// More aggressive memory management
user_pref("browser.tabs.unloadOnLowMemory", true);
user_pref("memory.free_dirty_pages", true);

// Disable unnecessary animations
user_pref("ui.prefersReducedMotion", 1);

// Improve YouTube performance
user_pref("media.cache_size", 512000); // 512MB media cache
user_pref("media.mediasource.enabled", true);

// Reduce telemetry overhead
user_pref("toolkit.telemetry.enabled", false);
user_pref("toolkit.telemetry.unified", false);
user_pref("datareporting.healthreport.uploadEnabled", false);
user_pref("datareporting.policy.dataSubmissionEnabled", false);

// Better garbage collection
user_pref("javascript.options.mem.gc_incremental_slice_ms", 5);
user_pref("javascript.options.mem.gc_high_frequency_time_limit_ms", 1000);
