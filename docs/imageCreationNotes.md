# Image Creation Notes

## To install PiShrink:
```bash
wget https://raw.githubusercontent.com/Drewsif/PiShrink/master/pishrink.sh
```

```bash
chmod +x pishrink.sh
```

```bash
sudo mv pishrink.sh /usr/local/bin
```

## To make an image:
Create the image
```bash
sudo dd if=/dev/sdb of=rc-lap-timer-backup.img bs=4M status=progress
```

Shrink the image
```bash
sudo pishrink.sh rc-lap-timer-backup.img rc-lap-timer-final.img
```
