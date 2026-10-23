#!/bin/sh
# Puts the phone recording inside the iPhone bezel on the animated background.
cd "$(dirname "$0")/out" && ${FFMPEG:-ffmpeg} -loglevel error -y -i ambient-phonebg.mp4 -i seg/phone.mp4 -loop 1 -i seg/mask.png -loop 1 -i seg/bezel.png -filter_complex "[1:v]scale=414:900,format=yuva420p[pv];[2:v]scale=414:900,format=gray[m];[pv][m]alphamerge[ph];[0:v][ph]overlay=1130:90:shortest=1[a];[a][3:v]overlay=0:0:shortest=1,format=yuv420p[o]" -map "[o]" -t 17.1 -r 30 -c:v libx264 -crf 17 -preset medium seg/phoneclip.mp4
