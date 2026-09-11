from pathlib import Path
import subprocess, time, json, re

root=Path(__file__).resolve().parent
events=[]
started=time.monotonic()
def event(name):
    item={'seconds':round(time.monotonic()-started,3),'event':name}
    events.append(item)
    print(json.dumps(item,ensure_ascii=False),flush=True)
def script(name,*args):
    result=subprocess.run(['osascript',str(root/name),*args],capture_output=True,text=True,check=True)
    return result.stdout.strip()
def foreground():
    subprocess.run(['osascript','-e','tell application "System Events" to tell process "Google Chrome"\nset frontmost to true\nperform action "AXRaise" of (first window whose name contains "日语听力工作室")\nend tell'],capture_output=True,check=True)
def position(name):
    nums=[float(n) for n in re.findall(r'\d+',script('position.applescript',name))]
    return nums[0]+nums[2]/2,nums[1]+nums[3]/2
def drag(name,dx,dy):
    foreground()
    x,y=position(name)
    subprocess.run([str(root/'capture/mouse'),str(x),str(y),str(x+dx),str(y+dy)],check=True)
    event('drag '+name)

rec=subprocess.Popen([str(root/'capture/record'),str(root/'capture/take-final.mp4'),'52'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
for line in rec.stdout:
    print(line.strip(),flush=True)
    if 'RECORDING_STARTED' in line:
        started=time.monotonic();break
else: raise RuntimeError('Recorder did not start')
try:
    foreground()
    subprocess.run([str(root/'capture/mouse'),'1510','215'],check=True)
    time.sleep(1)
    script('open-popup.applescript');event('open popup')
    time.sleep(2)
    script('ui.applescript','开始翻译当前标签页');event('start translation')
    time.sleep(2)
    foreground()
    script('ui.applescript','播放日语音频');event('play original audio')
    time.sleep(15)
    subprocess.run(['screencapture','-x','-o','-l7282',str(root/'capture/final-captions.png')],check=True)
    drag('⠿ 拖动字幕',-130,-145)
    time.sleep(2)
    drag('↘ 拖动调整宽高',110,60)
    time.sleep(2)
    script('ui.applescript','显示日文原文');event('show original Japanese')
    time.sleep(3)
    subprocess.run(['screencapture','-x','-o','-l7282',str(root/'capture/final-settings.png')],check=True)
finally:
    try:
        script('open-popup.applescript');time.sleep(1);script('ui.applescript','停止翻译');event('stop translation')
    except Exception as error: print('STOP CHECK REQUIRED:',error,flush=True)
    (root/'capture/events.json').write_text(json.dumps(events,ensure_ascii=False,indent=2))
    remaining=rec.communicate(timeout=60)[0]
    print(remaining,flush=True)
    if rec.returncode: raise RuntimeError('Recorder failed')
