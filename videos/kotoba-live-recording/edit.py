from pathlib import Path
import subprocess

root=Path(__file__).resolve().parent
original=root.parent/'kotoba-launch-zh/renders/kotoba-live-ja-zh-1080p.mp4'
def run(args): subprocess.run(['ffmpeg','-y','-v','warning',*args],check=True)
common=['-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','192k','-ar','48000','-ac','2']
run(['-i',str(original),'-t','3.5','-vf','fps=30,setsar=1','-af','afade=t=out:st=3.2:d=0.3',*common,str(root/'capture/intro.mp4')])
subprocess.run(['swift',str(root/'labels.swift'),str(root/'capture')],check=True)
inputs=[]
for index in range(3): inputs+=['-loop','1','-i',str(root/f'capture/label-{index}.png')]
filters='[0:v]scale=1728:972:flags=lanczos,pad=1920:1080:96:72:color=0xf5f4ec,setsar=1[base];[base][1:v]overlay=0:0:enable=lt(t\\,6.5)[a];[a][2:v]overlay=0:0:enable=between(t\\,6.5\\,17.5)[b];[b][3:v]overlay=0:0:enable=gte(t\\,17.5)[v]'
run(['-ss','2.5','-i',str(root/'capture/take-final.mp4'),*inputs,'-t','24.5','-filter_complex',filters,'-map','[v]','-map','0:a','-af','afade=t=in:st=0:d=0.2,afade=t=out:st=24.2:d=0.3',*common,str(root/'capture/main.mp4')])
run(['-ss','27.7','-i',str(original),'-t','4','-vf','fps=30,setsar=1','-af','afade=t=in:st=0:d=0.3,afade=t=out:st=3.5:d=0.5',*common,str(root/'capture/outro.mp4')])
concat=root/'capture/concat.txt'
concat.write_text('\n'.join("file '"+str(root/'capture'/name)+"'" for name in ['intro.mp4','main.mp4','outro.mp4']))
run(['-f','concat','-safe','0','-i',str(concat),'-c','copy','-movflags','+faststart',str(root/'renders/kotoba-live-real-demo-zh-1080p.mp4')])
