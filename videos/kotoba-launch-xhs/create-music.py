"""Original instrumental score: soft electric-piano arpeggios and a warm pad."""
import numpy as np
import wave
sr=48000; duration=32; n=sr*duration
mix=np.zeros((n,2),dtype=np.float64)
chords=[[52,59,63,66,71],[49,56,59,63,68],[45,52,56,59,64],[47,54,57,61,66]]
def tone(note,start,length,amplitude,pan=0,kind="piano"):
    i=int(start*sr); count=min(int(length*sr),n-i)
    if count<=0:return
    t=np.arange(count)/sr; f=440*2**((note-69)/12)
    if kind=="pad":
        env=np.minimum(t/1.3,1)*np.minimum((length-t)/1.7,1)
        sig=(np.sin(2*np.pi*f*t)+.18*np.sin(2*np.pi*(f*1.002)*t))*.65
    else:
        env=(1-np.exp(-t*70))*np.exp(-t/1.25)*np.minimum((length-t)/.15,1)
        sig=np.sin(2*np.pi*f*t)+.28*np.sin(2*np.pi*f*2*t)*np.exp(-t*2)+.08*np.sin(2*np.pi*f*3*t)*np.exp(-t*4)
    sig*=np.maximum(env,0)*amplitude
    mix[i:i+count,0]+=sig*np.sqrt((1-pan)/2)
    mix[i:i+count,1]+=sig*np.sqrt((1+pan)/2)
for section in range(8):
    chord=chords[section%4]; start=section*4
    for j,note in enumerate(chord[:4]): tone(note,start,5,.028,(j-1.5)*.27,"pad")
    for step in range(8): tone(chord[[0,2,3,4,2,1,3,4][step]]+12,start+step*.5,2.8,.058,(-1 if step%2 else 1)*.24)
t=np.arange(n)/sr
fade=np.minimum(t/1.2,1)*np.minimum((duration-t)/2.6,1)
# Duck the score under the Japanese sample, with smooth transitions.
duck=.78-.53*np.clip((t-5.7)/.4,0,1)+.53*np.clip((t-20.2)/.4,0,1)
mix*=fade[:,None]*duck[:,None]
with wave.open("assets/original-score.wav","wb") as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(sr);f.writeframes((np.clip(mix,-1,1)*32767).astype("<i2").tobytes())
print("Original 32-second score written; peak",round(float(np.max(np.abs(mix))),4))
