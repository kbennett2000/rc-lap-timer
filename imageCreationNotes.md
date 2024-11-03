# Image Creation Notes

## To install PiShrink:
```bash
wget https://raw.githubusercontent.com/Drewsif/PiShrink/master/pishrink.sh
chmod +x pishrink.sh
sudo mv pishrink.sh /usr/local/bin
```

## To make an image:
```bash
# Create the image
sudo dd if=/dev/sdb of=rc-lap-timer-backup.img bs=4M status=progress

# Shrink the image
sudo pishrink.sh rc-lap-timer-backup.img rc-lap-timer-final.img
```
