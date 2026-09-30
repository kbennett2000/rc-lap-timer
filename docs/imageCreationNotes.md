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
First, on the Pi you're imaging, delete its HTTPS certificate and key, then shut it down. Every Pi flashed from the
image then makes its own at first boot (`rc-lap-timer-tls.service`), instead of all of them sharing this one's key:
```bash
sudo rm -f /etc/ssl/private/rc-lap-timer.key /etc/ssl/certs/rc-lap-timer.crt /etc/ssl/certs/rc-lap-timer-ca.crt
sudo shutdown now
```

Create the image
```bash
sudo dd if=/dev/sdb of=rc-lap-timer-backup.img bs=4M status=progress
```

Shrink the image
```bash
sudo pishrink.sh rc-lap-timer-backup.img rc-lap-timer-final.img
```
