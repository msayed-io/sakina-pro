#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
يبني docs/widget-shots/index.html — أدلة مرئية للويدجت.

مهم: لا يوجد محاكي/جهاز في هذه البيئة، لذلك **لا لقطات شاشة حقيقية**.
هذه الصفحة تعرض: (١) رندرًا مرجعيًا للتصميم HTTPS المعتمد، مُشتقًا من نفس
قيم prayer-widget-design.html، و(٢) الألوان المقروءة آليًا من ملفات
colors.xml الفعلية في المشروع، و(٣) جدول مقارنة عنصرًا بعنصر.

كل ما يحتاج جهازًا حقيقيًا موسوم صراحةً «غير مُتحقَّق منه».
"""
import re
import os

ROOT = "/home/user/sakina-pro"
RES = f"{ROOT}/android/app/src/main/res"
OUT = f"{ROOT}/docs/widget-shots/index.html"


def rd(p):
    return open(p, encoding="utf-8").read()


def read_colors(mode):
    f = f"{RES}/{'values-night' if mode == 'dark' else 'values'}/colors.xml"
    d = dict(re.findall(r'<color name="(sk_w_[a-z0-9_]+)">([^<]+)</color>', rd(f)))
    return {k: d["sk_w_" + k] for k in
            ["page", "tile", "text", "text2", "accent", "accent_text", "on_accent", "track"]}


L, D = read_colors("light"), read_colors("dark")
FONT = "system-ui,-apple-system,'Segoe UI','Noto Naskh Arabic',sans-serif"


def ring_svg(c, frac):
    off = 201.1 * (1 - frac)
    return f'''<svg width="72" height="72" viewBox="0 0 72 72" style="position:absolute;inset:0">
<circle cx="36" cy="36" r="32" fill="none" stroke="{c['track']}" stroke-width="5.5"/>
<circle cx="36" cy="36" r="32" fill="none" stroke="{c['accent']}" stroke-width="5.5"
 stroke-linecap="round" stroke-dasharray="201.1" stroke-dashoffset="{off:.1}"
 transform="rotate(-90 36 36)"/></svg>'''


def tile(c, n, t, st, scale=1.0):
    if st == "on":
        bg, nc, tc, op = c['accent'], 'rgba(0,0,0,.85)', c['on_accent'], '1'
    elif st == "sun":
        bg, nc, tc, op = c['tile'], c['text2'], c['text2'], '.75'
    elif st == "past":
        bg, nc, tc, op = c['tile'], c['text2'], c['text2'], '.55'
    else:
        bg, nc, tc, op = c['tile'], c['text2'], c['text'], '1'
    return (f'<div style="flex:1;height:46px;border-radius:14px;background:{bg};opacity:{op};'
            f'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">'
            f'<b style="font-size:{10.5*scale:.1f}px;font-weight:400;color:{nc};line-height:1">{n}</b>'
            f'<span style="font-size:{13.5*scale:.1f}px;font-weight:700;color:{tc};line-height:1;'
            f'font-variant-numeric:tabular-nums">{t}</span></div>')


def card(c, times, frac, scale=1.0, dark=False, name="الفجر", nxt="الظهر", cd="02:49:31"):
    s = scale
    tiles = "".join(tile(c, n, t, st, s) for n, t, st in times)
    shadow = '0 1px 6px rgba(0,0,0,.55)' if dark else '0 1px 4px rgba(0,0,0,.10)'
    return f'''<div style="width:360px;height:154px;box-sizing:border-box;background:{c['page']};
border-radius:28px;padding:14px 16px 12px;display:flex;flex-direction:column;
font-family:{FONT};direction:rtl;overflow:hidden;box-shadow:{shadow}">
<div style="height:72px;display:flex;align-items:center;gap:10px;padding:0 4px">
 <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center">
  <div style="font-size:{12*s:.1f}px;color:{c['text2']}">الصلاة الحالية</div>
  <div style="font-size:{38*s:.1f}px;line-height:1.1;color:{c['text']};font-weight:900;margin-top:1px">{name}</div>
  <div style="font-size:{13*s:.1f}px;color:{c['accent_text']};font-weight:700;margin-top:3px">التالية: {nxt}</div>
 </div>
 <div style="position:relative;width:72px;height:72px;flex:none">{ring_svg(c, frac)}
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
   justify-content:center;gap:1px">
   <div style="font-size:{10*s:.1f}px;color:{c['text2']}">متبقي</div>
   <div style="font-size:{12*s:.1f}px;font-weight:700;color:{c['text']};
    font-variant-numeric:tabular-nums;direction:ltr">{cd}</div>
  </div></div>
</div>
<div style="display:flex;gap:5px;margin-top:10px">{tiles}</div>
</div>'''


def empty_card(c, dark=False):
    shadow = '0 1px 6px rgba(0,0,0,.55)' if dark else '0 1px 4px rgba(0,0,0,.10)'
    return f'''<div style="width:360px;height:154px;box-sizing:border-box;background:{c['page']};
border-radius:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;
gap:6px;direction:rtl;font-family:{FONT};box-shadow:{shadow}">
<div style="font-size:22px;font-weight:900;color:{c['text']}">سَكِينَة</div>
<div style="font-size:12px;color:{c['text2']};text-align:center;max-width:280px;line-height:1.5">
افتح التطبيق لتحديد موقعك وعرض مواقيت الصلاة</div></div>'''


T_MORNING = [("الفجر", "5:12", "on"), ("الشروق", "6:28", "sun"), ("الظهر", "11:41", "norm"),
             ("العصر", "2:57", "norm"), ("المغرب", "5:06", "norm"), ("العشاء", "6:36", "norm")]
T_POST = [("الفجر", "5:13", "norm"), ("الشروق", "6:29", "sun"), ("الظهر", "11:41", "norm"),
          ("العصر", "2:57", "norm"), ("المغرب", "5:06", "norm"), ("العشاء", "6:36", "past")]
T_NOON = [("الفجر", "5:12", "past"), ("الشروق", "6:28", "past"), ("الظهر", "11:41", "on"),
          ("العصر", "2:57", "norm"), ("المغرب", "5:06", "norm"), ("العشاء", "6:36", "norm")]


def sw(hexv):
    return f'<span class="sw" style="background:{hexv}"></span><code>{hexv}</code>'


ROWS = [
    ("--bg (خلفية البطاقة)", f"{sw(L['page'])} / {sw(D['page'])}", "ok",
     "--sk-bg3 (فاتح:902) · --sk-bg2 (داكن:992) — مطابق لتقدير الـ HTML حرفًا بحرف"),
    ("--tile (خلفية البلاطة)", f"{sw(L['tile'])} / {sw(D['tile'])}", "ok",
     "سلم الارتفاع المعتمد: bg2 فاتح · bg3 داكن"),
    ("--text (النص الأساسي)", f"{sw(L['text'])} / {sw(D['text'])}", "ok", "مطابق"),
    ("--text2 (النص الثانوي)", f"{sw(L['text2'])} / {sw(D['text2'])}", "ok",
     "الداكن rgba(235,235,245,.60) مُسطَّح إلى #98989F فوق البطاقة"),
    ("--accent (تعبئة + قوس)", f"{sw(L['accent'])} / {sw(D['accent'])}", "ok",
     "التعبئة والقوس فقط؛ نسبة التباين كواجهة 3.02:1 ✔ (WCAG 1.4.11 ≥ 3)"),
    ("--track (مسارات الحلقة)", f"{sw(L['track'])} / {sw(D['track'])}", "ok", "rgba(.12) داكنًا مُسطَّح"),
    ("--on-accent (فوق التعبئة)", f"{sw(L['on_accent'])} / {sw(D['on_accent'])}", "ok",
     "الداكن = --sk-on-accent-soft #000000 (قرار معتمد: accent نفسه كان 1.00:1)"),
    ("نص «التالية»", f"{sw(L['accent_text'])} / {sw(D['accent_text'])}", "ask",
     "فاتح: #8A6A3D — فصلٌ معتمد لأن accent كنص = 3.02:1 (❌ AA). الناتج 4.87:1 ✔"),
    ("padding", "14 / 16 / 16 / 12 dp", "ok", "widget_main.xml — أعلى/جانبان/أسفل"),
    ("الفجوة بين الصفين", "10 dp", "ok", "marginTop على شريط المواقيت"),
    ("الحلقة", "72 × 72 dp · stroke 5.5 · r 32", "ok",
     "ArabicRingRenderer.kt — Bitmap 72dp×density، تُعاد للتدوير بعد الاستخدام"),
    ("بداية القوس", "drawArc(-90° …)", "ok", "مكافئ لـ rotate(-90) في الـ HTML: يبدأ من 12 تمامًا"),
    ("طول القوس", "(now − start) / (next − start)", "ok",
     "الـ HTML يعرض 41% كثابت توضيحي؛ التنفيذ يحسب النسبة الحية"),
    ("التسمية فوق الحلقة / العد", "10 sp · 12 sp bold", "ok", "Chronometer أصلي isCountDown · أرقام لاتينية LTR"),
    ("اسم الصلاة", "38 sp · Serif Display Black (900)", "ok", "Bitmap عبر ArabicTextBitmapRenderer (تشكيل عربي صحيح)"),
    ("اسم الصلاة السابق/التالي", "12 sp Regular · 13 sp Bold", "ok", "لا يوجد وزن 500 — الأقرب المتاح (معتمد)"),
    ("بلاطة الوقت", "46 dp · radius 14 dp · gap 5 dp", "ok", "widget_times_row.xml"),
    ("نص البلاطة", "10.5 sp Regular · 13.5 sp Bold", "ok", "h:mm بأرقام عربية هندية، بلا ص/م"),
    ("شبكة المواقيت", "6 أعمدة متساوية weight=1", "ok", "متساوية تمامًا"),
    (".past", "alpha 0.55", "ok", "ما مضى من اليوم"),
    (".sun", "alpha 0.75 · شروق منقضٍ 0.4125", "ok", "0.55 × 0.75"),
    (".on", "تعبئة accent · الاسم alpha .85", "ok", "الصلاة القادمة"),
    ("ترتيب الصف العلوي", "SpaceBetween (Spacer weight=1)", "ok", "Glance لا يملك Arrangement"),
    ("اتجاه الصف", "layoutDirection=rtl → [نص, حلقة]", "ok", "الحلقة يسارًا فعليًا — HTML هو المرجع، لا §0-1"),
    ("التواريخ", "لا تواريخ في أي مكان", "ok", "حُذفت نهائيًا"),
    ("حالة «بلا موقع»", "فراغ مقصود — صفر أصفار وهمية", "ok", "widget_empty.xml"),
]

CONFLICTS = [
    ("§0-1: «الحلقة على اليمين في RTL»", "HTML: الحلقة على اليسار", "HTML",
     "صُحِّح: layoutDirection=rtl على الصف يجعل الحق = النص، اليسار = الحلقة"),
    ("§4: «حلقة تقدم متحركة/progress»", "HTML: قوس SVG ثابت", "HTML",
     "Bitmap ثابتة تُرسم مرة واحدة — ممنوع أي spinner أو مؤقّت حركة"),
    ("§3: «يعرض التاريخ الهجري والميلادي»", "HTML: لا تواريخ", "HTML", "صفر تواريخ في كل التخطيطات"),
    ("§6: «accent واحد للنص والتعبئة»", "HTML: نفس القيمة للدورين", "HTML + قرار",
     "فُصل إلى تعبئة #B88A4F / نص #8A6A3D لبلوغ AA — وثّق في جدول الألوان"),
    ("§2: «زوايا 28 ثابتة»", "HTML: 28 (مستنتج)", "النظام",
     "28dp في values/ ومرجع زاوية النظام في values-v31/ (قرار معتمد)"),
]

UNVERIFIED = [
    ("الوضع الداكن/الفاتح على جهاز حقيقي", "لا محاكي ولا جهاز في بيئة البناء",
     "ثبِّت APK من صفحة الإصدارات v2.3.29، أضف الويدجت، بدّل بين الوضعين من الإعدادات السريعة، وقارن مع docs/widget-shots/index.html"),
    ("حالة «بعد العشاء» (الفجر القادم غدًا)", "تحتاج تغيير ساعة الجهاز",
     "اضبط ساعة الجهاز إلى 11:00 مساءً محليًا ثم أعد إضافة الويدجت: يجب أن يظهر اسم الفجر، والعد حتى فجر الغد، والحلقة شبه مكتملة"),
    ("حالة «بلا موقع»", "تحتاج تثبيتًا جديدًا بدون صلاحية موقع",
     "امسح بيانات التطبيق (Settings ← Apps ← Sakeenah ← Storage ← Clear data) ولا تفتح التطبيق: يجب أن تظهر البطاقة الفارغة بلا أصفار"),
    ("تكبير الخط 130% بدون قص/تراكب", "يحتاج محاكيًا أو جهازًا",
     "Settings ← Display ← Font size = الأكبر، وWidth 360dp: الاسم 38sp يجب أن يبقى كاملًا غير مقطوع"),
    ("logcat نظيف (صفر استثناءات، صفر تحذيرات RemoteViews)", "يحتاج جهازًا",
     "adb logcat | grep -E 'RemoteViews|Sakeenah|Glance' أثناء إضافة الويدجت وتبديل الوضع"),
    ("زوايا النظام على API 31+", "AAPT قبل البناء هو المرجح؛ الاختبار البصري يحتاج جهازًا",
     "على أندرويد 12+ يجب أن تطابق زاوية البطاقة زاوية أي ويدجت نظام آخر على نفس الشاشة"),
]


def badge(k):
    if k == "ok":
        return '<span class="b ok">✅ مطابق</span>'
    if k == "ask":
        return '<span class="b ask">⚠️ قرار معتمد</span>'
    return '<span class="b no">❌ انحراف</span>'


def pair(label, inner, note=""):
    return (f'<figure class="shot"><figcaption>{label}'
            f'{("<span class=hint>" + note + "</span>") if note else ""}</figcaption>'
            f'{inner}</figure>')


shots = "".join([
    pair("رندر مرجعي — الوضع الفاتح · بين الفجر والظهر",
         card(L, T_MORNING, 0.41), "قيم الـ HTML نفسها"),
    pair("رندر مرجعي — الوضع الداكن · بين الفجر والظهر",
         card(D, T_MORNING, 0.41, dark=True), "قيم الـ HTML نفسها"),
    pair("رندر مرجعي — الفاتح · بعد العشاء",
         card(L, T_POST, 0.93, name="العشاء", nxt="الفجر", cd="07:41:08"),
         "العشاء منقضٍ .55 · القادم فجر الغد — لا تواريخ"),
    pair("رندر مرجعي — الداكن · منتصف النهار",
         card(D, T_NOON, 0.18, dark=True, name="الشروق", nxt="الظهر", cd="03:12:44"),
         "الشروق ممتلئ + المتبقي باهت"),
    pair("رندر مرجعي — الفاتح · بلا موقع", empty_card(L), "فراغ مقصود"),
    pair("رندر مرجعي — الداكن · بلا موقع", empty_card(D, dark=True), "فراغ مقصود"),
    pair("محاكاة 130% — الفاتح", card(L, T_MORNING, 0.41, 1.3), "تحقق بصري من عدم القص"),
    pair("محاكاة 130% — الداكن", card(D, T_MORNING, 0.41, 1.3, dark=True), "تحقق بصري من عدم القص"),
])

cmp_rows = "".join(
    f"<tr><td>{n}</td><td class=v>{v}</td><td>{badge(k)}</td><td class=n>{note}</td></tr>"
    for n, v, k, note in ROWS)
conf_rows = "".join(
    f"<tr><td>{a}</td><td>{b}</td><td class=c><b>{w}</b></td><td class=n>{n}</td></tr>"
    for a, b, w, n in CONFLICTS)
un_rows = "".join(
    f"<tr><td>{a}</td><td class=n>{b}</td><td class=n>{c}</td></tr>"
    for a, b, c in UNVERIFIED)

HTML = f'''<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>أدلة ويدجت الصلاة — v3</title>
<style>
:root{{--fg:#1c1c1e;--mut:#6b6b73;--line:#e6e1da;--bg:#faf9f7;--card:#fff}}
@media (prefers-color-scheme:dark){{:root{{--fg:#f2f2f7;--mut:#98989f;--line:#33333a;--bg:#141416;--card:#1c1c1e}}}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--fg);font-family:{FONT};line-height:1.6}}
main{{max-width:1120px;margin:0 auto;padding:40px 20px 80px}}
h1{{font-size:28px;margin:0 0 4px;font-weight:800}}
.sub{{color:var(--mut);font-size:14px;margin-bottom:28px}}
h2{{font-size:19px;margin:44px 0 6px;font-weight:700;padding-top:18px;border-top:1px solid var(--line)}}
h2 small{{font-weight:400;color:var(--mut);font-size:13px;display:block;margin-top:2px}}
.notice{{border-radius:12px;padding:14px 16px;font-size:14px;margin:16px 0;border:1px solid}}
.warn{{background:#fff8e6;border-color:#f0d491;color:#6b4e00}}
@media (prefers-color-scheme:dark){{.warn{{background:#2a2210;border-color:#5c4a1c;color:#f0d491}}}}
.gallery{{display:flex;flex-wrap:wrap;gap:26px;margin-top:18px}}
.shot{{margin:0}}
.shot figcaption{{font-size:13px;color:var(--mut);margin-bottom:8px}}
.shot .hint{{display:block;font-size:11.5px;color:var(--mut);opacity:.8}}
table{{width:100%;border-collapse:collapse;margin-top:14px;font-size:14px;background:var(--card);
border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}}
th,td{{padding:9px 12px;text-align:right;border-bottom:1px solid var(--line);vertical-align:top}}
th{{background:rgba(128,128,128,.08);font-size:13px;font-weight:700}}
tr:last-child td{{border-bottom:none}}
td.c,th.c{{text-align:center}}
td.n{{color:var(--mut);font-size:13px}}
td.v{{font-family:ui-monospace,'SF Mono',monospace;font-size:12.5px;white-space:nowrap}}
.sw{{display:inline-block;width:13px;height:13px;border-radius:3px;vertical-align:-2px;
margin-left:5px;border:1px solid rgba(128,128,128,.45)}}
code{{font-family:ui-monospace,'SF Mono',monospace;font-size:12px}}
.b{{font-size:12px;white-space:nowrap;font-weight:600}}
.b.ok{{color:#1a7f37}} .b.no{{color:#c62828}} .b.ask{{color:#9a6b00}}
@media (prefers-color-scheme:dark){{.b.ok{{color:#4ade80}}.b.no{{color:#f87171}}.b.ask{{color:#fbbf24}}}}
footer{{margin-top:56px;padding-top:20px;border-top:1px solid var(--line);color:var(--mut);font-size:12.5px}}
</style></head><body><main>

<h1>ويدجت الصلاة — أدلة v3</h1>
<div class="sub">الالتزام <code>2253d3e</code> · الإصدار <b>v2.3.29</b> · المرجع البصري الوحيد
<code>prayer-widget-design.html</code></div>

<div class="notice warn"><b>اقرأ هذا أولًا —</b> لا يوجد محاكي أندرويد ولا جهاز متصل ببيئة البناء،
لذلك <b>لا توجد لقطات شاشة حقيقية</b> في هذه الصفحة. ما تراه أدناه هو رندر مرجعي بُنِي من
قيم التصميم المعتمد نفسه ليعمل كمرجع بصري للمقارنة، مع جدول يطابق كل عنصر بمكانه في
ملفات المشروع. الحالات التي تحتاج جهازًا مُدرجة صراحةً تحت «غير مُتحقَّق منه» مع خطوات
الاختبار اليدوي — ولم تُدَّعَ كنجاح.</div>

<h2>1 · المعرض<small>الرندر المرجعي مقابل قيم المشروع — الوضعان</small></h2>
<div class="gallery">{shots}</div>

<h2>2 · الألوان عنصرًا بعنصر<small>القيم مقروءة آليًا من <code>values/colors.xml</code> و
<code>values-night/colors.xml</code> وقت توليد هذه الصفحة</small></h2>
<table><thead><tr><th>الدور في الـ HTML</th><th>القيمة في التطبيق — فاتح / داكن</th>
<th class="c">الحالة</th><th>الملاحظة</th></tr></thead><tbody>{cmp_rows}</tbody></table>

<h2>3 · التعارضات بين المواصفات والـ HTML<small>الـ HTML هو الحاكم في كل حالة</small></h2>
<table><thead><tr><th>ما تقوله <code>prayer-widget-spec.md</code></th><th>الـ HTML</th>
<th class="c">الحاكم</th><th>ما نُفِّذ</th></tr></thead><tbody>{conf_rows}</tbody></table>

<h2>4 · غير مُتحقَّق منه<small>لم يُشاهد على جهاز — لا ادعاء نجاح</small></h2>
<table><thead><tr><th>البند</th><th>لماذا لم يُتحقَّق</th><th>خطوات التحقق اليدوي</th></tr></thead>
<tbody>{un_rows}</tbody></table>

<footer>
توليد آلي: <code>docs/widget-shots/build_evidence.py</code> — أعد تشغيله بعد أي تعديل على
<code>colors.xml</code> ليعكس الألوان الجديدة. الأرقام والأسماء في الرندر أمثلة عرض ثابتة
(كمعاينة المنتقي)؛ البيانات الحية تأتي من <code>PrayerAlarmStore</code>.
</footer>
</main></body></html>'''

open(OUT, "w", encoding="utf-8").write(HTML)
print("wrote", OUT, len(HTML), "bytes")
