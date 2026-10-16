"""Build deterministic Life Organizer vector masters and native resource sources.
Run from this source folder; SVGs and XMLs never depend on runtime fonts.
"""
from pathlib import Path
import json, shutil, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
ROOT=Path(__file__).resolve().parents[1]
FONT=Path(os.environ.get('LIFE_ORGANIZER_WORDMARK_FONT','/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'))
COLORS={'rose':'#AA4566','gold':'#B8935A','plum':'#482541','paper':'#F8F6F3','dark':'#34102E','ink':'#29232A','muted':'#6C636F','gymText':'#89642C','shopping':'#426554','calendar':'#3D5F7F','white':'#FFFFFF'}
L='M290 552 L91 388 C25 343 0 296 0 230 V82 C0 18 44 -10 92 8 L217 59 C263 79 290 105 290 139 Z'
R='M310 552 V139 C310 105 337 79 383 59 L508 8 C556 -10 600 18 600 82 V230 C600 296 575 343 509 388 Z'
# The two broad flat paths deliberately simplify the accepted raster concept.
def write(rel,text):
 p=ROOT/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text,encoding='utf8');return p

def svg(w,h,body,title='Life Organizer'):
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n'

def mark(x=0,y=0,width=600,mono=None):
 scale=width/600
 return f'<g transform="translate({x:g} {y:g}) scale({scale:g})"><path fill="{mono or COLORS["rose"]}" d="{L}"/><path fill="{mono or COLORS["gold"]}" d="{R}"/></g>'
font=TTFont(FONT);gs=font.getGlyphSet();cmap=font.getBestCmap();kerning={}
if 'kern' in font:
 for table in font['kern'].kernTables:kerning.update(table.kernTable)
pen=SVGPathPen(gs);bp=BoundsPen(gs);advance=0;previous=None
for ch in 'Life Organizer':
 name=cmap[ord(ch)]
 if previous:advance+=kerning.get((previous,name),0)
 trans=(1,0,0,1,advance,0)
 gs[name].draw(TransformPen(pen,trans));gs[name].draw(TransformPen(bp,trans))
 advance+=font['hmtx'][name][0];previous=name
WORD=pen.getCommands();x0,y0,x1,y1=bp.bounds

def wordmark(x,y,width,color=None):
 # y is the desired TOP of visible outline bounds, not a font baseline.
 scale=width/(x1-x0)
 tx=x-x0*scale;ty=y+y1*scale
 return f'<path fill="{color or COLORS["plum"]}" transform="translate({tx:.6f} {ty:.6f}) scale({scale:.6f} {-scale:.6f})" d="{WORD}"/>'

for name,color in [('color',None),('plum',COLORS['plum']),('white',COLORS['white']),('currentcolor','currentColor')]:
 write(f'brand/mark-{name}.svg',svg(640,592,mark(20,20,600,color),'Life Organizer — symbole'))
write('brand/logo-stacked-color.svg',svg(1200,1120,mark(320,80,560)+wordmark(80,715,1040)))
write('brand/logo-stacked-white.svg',svg(1200,1120,mark(320,80,560,COLORS['white'])+wordmark(80,715,1040,COLORS['white'])))
write('brand/logo-stacked-plum.svg',svg(1200,1120,mark(320,80,560,COLORS['plum'])+wordmark(80,715,1040)))
write('brand/logo-horizontal-color.svg',svg(1500,380,mark(65,75,250)+wordmark(365,122,1070)))
write('brand/logo-horizontal-white.svg',svg(1500,380,mark(65,75,250,COLORS['white'])+wordmark(365,122,1070,COLORS['white'])))
# Tight wordmark canvas, with clear space to protect descenders.
wordheight=(y1-y0)/(x1-x0)*1100
write('brand/wordmark-plum.svg',svg(1200,round(wordheight+100),wordmark(50,50,1100)))
write('brand/wordmark-white.svg',svg(1200,round(wordheight+100),wordmark(50,50,1100,COLORS['white'])))
write('source/brand-geometry.json',json.dumps({'markViewBox':[600,552],'leftPath':L,'rightPath':R,'wordmarkText':'Life Organizer','wordmarkSourceTypeface':'DejaVu Serif Bold','wordmarkPath':WORD,'wordmarkBounds':[x0,y0,x1,y1],'colors':COLORS},indent=2))
# SVG master has no baked-in rounded-square mask. Android owns adaptive masking.
write('brand/app-icon-square.svg',svg(1024,1024,f'<path fill="{COLORS["paper"]}" d="M0 0H1024V1024H0Z"/>'+mark(172,199.2,680)))
write('brand/adaptive-foreground.svg',svg(108,108,mark(27.9,29.988,52.2)))
write('brand/adaptive-monochrome.svg',svg(108,108,mark(27.9,29.988,52.2,COLORS['white'])))
write('brand/adaptive-background.svg',svg(108,108,f'<path fill="{COLORS["paper"]}" d="M0 0H108V108H0Z"/>'))
write('brand/pwa-maskable.svg',svg(512,512,f'<path fill="{COLORS["paper"]}" d="M0 0H512V512H0Z"/>'+mark(96,108.8,320)))
# Native Android resources. Prefix avoids collisions with the unseen repository.
ANDROID='http://schemas.android.com/apk/res/android'
def vector(view=108,widthdp=108,markwidth=52.2,mono=None):
 scale=markwidth/600;tx=(view-markwidth)/2;ty=(view-552*scale)/2
 return f'''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="{ANDROID}" android:width="{widthdp}dp" android:height="{widthdp}dp" android:viewportWidth="{view}" android:viewportHeight="{view}">
  <group android:translateX="{tx:.6f}" android:translateY="{ty:.6f}" android:scaleX="{scale:.8f}" android:scaleY="{scale:.8f}">
    <path android:fillColor="{mono or COLORS['rose']}" android:pathData="{L}" />
    <path android:fillColor="{mono or COLORS['gold']}" android:pathData="{R}" />
  </group>
</vector>
'''
write('android-res/drawable/lo_launcher_foreground.xml',vector())
write('android-res/drawable/lo_launcher_monochrome.xml',vector(mono=COLORS['white']))
write('android-res/drawable/lo_splash_icon.xml',vector(288,288,150))
write('android-res/drawable/lo_splash_icon_dark.xml',vector(288,288,150,COLORS['white']))
write('android-res/drawable/lo_notification.xml',vector(24,24,20,COLORS['white']))
write('android-res/values/lo_brand_colors.xml',f'''<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="lo_icon_background">{COLORS['paper']}</color>
  <color name="lo_splash_background">{COLORS['paper']}</color>
  <color name="lo_splash_background_dark">{COLORS['dark']}</color>
  <color name="lo_notification_accent">{COLORS['rose']}</color>
</resources>
''')
for folder,mono in [('mipmap-anydpi-v26',False),('mipmap-anydpi-v33',True)]:
 contents=f'''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="{ANDROID}">
  <background android:drawable="@color/lo_icon_background" />
  <foreground android:drawable="@drawable/lo_launcher_foreground" />
'''+('  <monochrome android:drawable="@drawable/lo_launcher_monochrome" />\n' if mono else '')+'</adaptive-icon>\n'
 for stem in ['lo_launcher','lo_launcher_round']:write(f'android-res/{folder}/{stem}.xml',contents)
# Small brand-aligned chapter glyphs, separate from the project's existing Ionicons.
ICONS={
'notes':('<rect x="4" y="4" width="24" height="20" rx="7"/><path d="m10 24-4 4v-8m4-9h12m-12 5h8"/>',COLORS['rose']),
'memories':('<rect x="8" y="8" width="21" height="21" rx="5"/><path d="M23 4H9a5 5 0 0 0-5 5v14"/><circle cx="14" cy="14" r="2"/><path d="m8 24 7-7 5 5 4-4 5 5"/>',COLORS['plum']),
'gym':('<path d="M4 11v10m5-14v18m14-18v18m5-14v10M9 16h14"/>',COLORS['gymText']),
'shopping':('<path d="M5 10h22l-2 18H7L5 10Z"/><path d="M11 10V8a5 5 0 0 1 10 0v2m-10 7v5m5-5v5m5-5v5"/>',COLORS['shopping']),
'calendar':('<rect x="4" y="7" width="24" height="22" rx="5"/><path d="M10 3v8m12-8v8M4 15h24m-16 6h3m4 0h3"/>',COLORS['calendar']),
'little-plans':('<path d="M16 28 5 17C-1 9 10 1 16 9c6-8 17 0 11 8L16 28Z"/>',COLORS['rose'])}
for name,(paths,color) in ICONS.items():
 for variant,stroke in [('', 'currentColor'),('-color',color)]:
  write(f'chapters/{name}{variant}.svg',svg(32,32,f'<g fill="none" stroke="{stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{paths}</g>',name))
 if name in ['notes','memories','gym']:
  soft={'notes':'#F4E5EB','memories':'#EDE6EF','gym':'#F3EBDD'}[name]
  art=f'<rect x="36" y="22" width="184" height="140" rx="40" fill="{soft}"/><g transform="translate(88 52) scale(2.5)" fill="none" stroke="{color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{paths}</g>'
  write(f'empty-states/{name}.svg',svg(256,192,art,f'Illustration vide — {name}'))
# Notification SVG also supplied for asset pipelines that require PNG output.
write('brand/notification-white.svg',svg(24,24,mark(2,2.8,20,COLORS['white']),'Life Organizer notification'))
write('brand/splash-icon.svg',svg(288,288,mark(69,75,150)))
write('brand/splash-icon-white.svg',svg(288,288,mark(69,75,150,COLORS['white'])))
write('colors.json',json.dumps(COLORS,indent=2))
write('colors.css',':root {\n'+''.join(f'  --lo-brand-{k}: {v};\n' for k,v in COLORS.items())+'}\n')
shutil.copy('/usr/share/doc/fonts-dejavu-core/copyright',ROOT/'licenses/WORDMARK-TYPEFACE-LICENSE.txt')
print('Vector masters, outlined lettering, chapter glyphs and Android XML sources generated.')
