import { SampleVideo, QualityPreset } from '../types';

export const SAMPLE_VIDEOS: SampleVideo[] = [
  {
    id: 'timer-test',
    title: 'Ultra-Low Latency Millisecond Timer',
    titleFa: 'تست تأخیر میلی‌ثانیه‌ای (Timecode دقیق ۶۰ فریم)',
    duration: 120,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1508962914676-134849a727f0?w=600&auto=format&fit=crop&q=80',
    resolution: '1080p',
    fps: 60,
    descriptionFa: 'ویدئوی بهینه با فریم‌ریت بالا برای مقایسه دیداری فریم به فریم و اثبات حداقل تأخیر'
  },
  {
    id: 'tears-of-steel',
    title: 'Tears of Steel (Sci-Fi 4K/1080p)',
    titleFa: 'فیلم علمی‌تخیلی Tears of Steel (حرکت سریع و کیفیت بالا)',
    duration: 734,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    resolution: '1080p',
    fps: 30,
    descriptionFa: 'اکشن و گرافیک بالا برای آزمایش استریم روان و کدک H.264 / VP8'
  },
  {
    id: 'sintel',
    title: 'Sintel Animation Adventure',
    titleFa: 'انیمیشن ماجراجویی سینتل (سینمایی رنگی)',
    duration: 52,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    resolution: '720p',
    fps: 30,
    descriptionFa: 'رنگ‌های پویا و جزئیات دقیق جهت بررسی پایداری تصویر'
  },
  {
    id: 'big-buck-bunny',
    title: 'Big Buck Bunny Nature',
    titleFa: 'انیمیشن طبیعت و حیوانات (Big Buck Bunny)',
    duration: 596,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    resolution: '720p',
    fps: 30,
    descriptionFa: 'محتوای استاندارد تست استریم با کنتراست طبیعی'
  }
];

export const QUALITY_PRESETS: QualityPreset[] = [
  {
    id: 'auto',
    nameFa: 'خودکار (تطبیقی با سرعت شبکه)',
    nameEn: 'Adaptive Auto',
    maxBitrateKbps: 3500,
    scaleDown: 1.0,
    maxFps: 60
  },
  {
    id: 'ultra',
    nameFa: 'کیفیت فوق‌العاده ۱۰۸۰p (حداکثر بیت‌ریت)',
    nameEn: '1080p 60fps (High)',
    maxBitrateKbps: 5000,
    scaleDown: 1.0,
    maxFps: 60
  },
  {
    id: 'balanced',
    nameFa: 'متعادل ۷۲۰p (کمترین تأخیر روی Wi-Fi معمولی)',
    nameEn: '720p 30fps (Balanced)',
    maxBitrateKbps: 2200,
    scaleDown: 1.5,
    maxFps: 30
  },
  {
    id: 'low-latency',
    nameFa: 'حالت فوق‌سریع ۴۸۰p (تأخیر زیر ۲۰ میلی‌ثانیه)',
    nameEn: '480p Ultra-Low Latency',
    maxBitrateKbps: 1000,
    scaleDown: 2.0,
    maxFps: 30
  }
];
