"""Behavior checks for narrated promo timing, input safety and actual tiny export."""
import importlib.util,json,math,os
from pathlib import Path
import shutil,struct,subprocess,sys,tempfile,unittest,wave
from PIL import Image
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('promo',HERE/'render_promo.py');promo=importlib.util.module_from_spec(spec);spec.loader.exec_module(promo)
class PromoTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
  Image.new('RGB',(128,224),'#482541').save(self.root/'bg.png')
  Image.new('RGBA',(64,64),'#aa4566').save(self.root/'type.png')
  for name,seconds in [('voice.wav',.2),('music.wav',1.2)]:
   with wave.open(str(self.root/name),'wb') as out:
    out.setnchannels(1);out.setsampwidth(2);out.setframerate(48000)
    out.writeframes(b''.join(struct.pack('<h',round(3000*math.sin(2*math.pi*330*i/48000))) for i in range(int(seconds*48000))))
  scene={'id':'one','duration':.6,'spoken':'Hello','voice':'voice.wav','background':'bg.png','layers':[{'file':'type.png','x':10,'y':30,'motion':'float'}]}
  self.plan={'width':128,'height':224,'fps':30,'music':'music.wav','music_credit':'Original test tone','voice_credit':'Synthetic test tone','scenes':[scene,{**scene,'id':'two','spoken':'Again'}]}
  self.path=self.root/'plan.json';self.save()
 def save(self):self.path.write_text(json.dumps(self.plan))
 def tearDown(self):self.temp.cleanup()
 def test_rejects_cut_off_narration(self):
  self.plan['scenes'][0]['duration']=.3;self.save()
  with self.assertRaisesRegex(ValueError,'cut off'):promo.read_plan(self.path)
 def test_rejects_nonfinite_and_delayed_layers(self):
  self.plan['scenes'][0]['duration']=float('nan');self.save()
  with self.assertRaises(ValueError):promo.read_plan(self.path)
  self.plan['scenes'][0]['duration']=.6;self.plan['scenes'][0]['layers'][0]['delay']=2;self.save()
  with self.assertRaisesRegex(ValueError,'after scene'):promo.read_plan(self.path)
 def test_requires_audio_rights_and_independent_layers(self):
  self.plan['music_credit']='';self.save()
  with self.assertRaises(ValueError):promo.read_plan(self.path)
  self.plan['music_credit']='Original';self.plan['scenes'][0]['layers']=[];self.save()
  with self.assertRaisesRegex(ValueError,'animated'):promo.read_plan(self.path)
 @unittest.skipUnless(shutil.which('ffmpeg'),'FFmpeg unavailable')
 def test_real_export_has_audio_and_caption_timing(self):
  out=self.root/'promo.mp4';promo.render(promo.read_plan(self.path),out,shutil.which('ffmpeg'))
  self.assertGreater(out.stat().st_size,1000)
  with wave.open(str(out.with_suffix('.voice.wav')),'rb') as stem:
   self.assertAlmostEqual(stem.getnframes()/stem.getframerate(),1.2,places=2)
   self.assertEqual(stem.getframerate(),48000)
  self.assertLess(out.with_suffix('.voice.wav').stat().st_size,150000)
  captions=out.with_suffix('.srt').read_text();self.assertIn('00:00:00,150 --> 00:00:00,350',captions);self.assertIn('00:00:00,750 --> 00:00:00,950',captions)
  decoded=subprocess.run([shutil.which('ffmpeg'),'-v','error','-i',str(out),'-map','0:a:0','-f','s16le','-ac','1','-'],capture_output=True,check=True)
  self.assertGreater(len(decoded.stdout),48000)
  self.assertTrue(any(decoded.stdout))
  info=subprocess.run([shutil.which('ffmpeg'),'-hide_banner','-i',str(out),'-f','null','-'],capture_output=True,text=True,check=True)
  self.assertRegex(info.stderr,r'Audio: aac[^\n]*stereo')
  before=out.read_bytes();result=subprocess.run([sys.executable,str(HERE/'render_promo.py'),str(self.path),'--output',str(out)],capture_output=True)
  self.assertNotEqual(result.returncode,0);self.assertEqual(out.read_bytes(),before)
if __name__=='__main__':unittest.main()
