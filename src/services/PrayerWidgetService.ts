import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * PrayerWidgetService — جسر رقيق لزر «إضافة ويدجت للشاشة الرئيسية».
 *
 * لا يحمل أي منطق بيانات. البيانات تُمرَّر عبر PrayerAlarmService.
 * هذا الملف مسؤول فقط عن نافذة التثبيت الرسمية التي يوفرها النظام
 * (GlanceAppWidgetManager.requestPinGlanceAppWidget).
 */

interface PrayerWidgetPluginApi {
  isSupported(): Promise<{ supported: boolean }>;
  requestPin(): Promise<{ supported: boolean; requested: boolean; error?: string }>;
  addListener(
    eventName: 'widgetPinResult',
    listener: (payload: { success: boolean }) => void,
  ): Promise<unknown> | unknown;
  removeAllListeners?(): Promise<void> | void;
}

const NativePrayerWidget = registerPlugin<PrayerWidgetPluginApi>('PrayerWidget');

class PrayerWidgetServiceImpl {
  private isNative(): boolean {
    try {
      return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    } catch {
      return false;
    }
  }

  /** هل يدعم مشغّل الشاشة نافذة التثبيت المباشر؟ */
  async isSupported(): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      const result = await NativePrayerWidget.isSupported();
      return result?.supported === true;
    } catch {
      return false;
    }
  }

  /**
   * يفتح نافذة التثبيت الرسمية.
   * @returns { supported, requested } — عند supported=false تعرض الواجهة إرشادًا.
   */
  async requestPin(): Promise<{ supported: boolean; requested: boolean }> {
    if (!this.isNative()) return { supported: false, requested: false };
    try {
      const result = await NativePrayerWidget.requestPin();
      return {
        supported: result?.supported === true,
        requested: result?.requested === true,
      };
    } catch {
      return { supported: false, requested: false };
    }
  }

  /**
   * يُستدعى عند عودة التطبيق من نافذة التأكيد.
   * الاستماع اختياري — الزر يُغلق النافذة بغض النظر.
   */
  async onPinResult(listener: (success: boolean) => void): Promise<() => void> {
    if (!this.isNative()) return () => undefined;
    try {
      const handle = await NativePrayerWidget.addListener('widgetPinResult', (payload) => {
        listener(payload?.success === true);
      });
      return () => {
        const removable = handle as { remove?: () => void } | undefined;
        removable?.remove?.();
      };
    } catch {
      return () => undefined;
    }
  }
}

export const PrayerWidgetService = new PrayerWidgetServiceImpl();
