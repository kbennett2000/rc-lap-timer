# Image Creation Notes
Make the image from a timer set up with [raspberryPiSetup.md](raspberryPiSetup.md) (hostname `rclaptimer`) and
upgraded to the current version, so the upgrade scripts in its home folder are current. Then update the README's
download link.

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

## Clear what belongs to this timer
Everything on the card goes into every timer flashed from the image. On the Pi you're imaging, copy off anything you
want to keep, then:

Its data (this also clears the timer's sync id, so each flashed timer gets its own):
```bash
cd ~ && ./clearDB.sh
rm -rf ~/db-backups/* ~/rc-lap-timer.previous
```

Its admin PIN (each owner sets their own at their first upgrade, or in `/etc/rc-lap-timer.env`), and the SSH keys
that let a build box log in without a password:
```bash
sudo rm -f /etc/rc-lap-timer.env
rm -f ~/.ssh/authorized_keys
```

Its HTTPS certificate and key. Every timer flashed from the image makes its own at first boot
(`rc-lap-timer-tls.service`), instead of all of them sharing this one's key. The service must be enabled, or flashed
timers boot without a certificate and nginx won't start:
```bash
sudo rm -f /etc/ssl/private/rc-lap-timer.key /etc/ssl/certs/rc-lap-timer.crt /etc/ssl/certs/rc-lap-timer-ca.crt
systemctl is-enabled rc-lap-timer-tls
```

⚠️ Its SSH host keys, so flashed timers don't all share them. Raspberry Pi OS makes new ones at first boot with the
`regenerate_ssh_host_keys` service; check it exists on your OS release before relying on it:
```bash
sudo rm -f /etc/ssh/ssh_host_*
sudo systemctl enable regenerate_ssh_host_keys
```

The `pi` user's password goes into the image too: say in the README what it is, and to change it (Manager → System
Settings).

Shut down:
```bash
sudo shutdown now
```

## To make an image:
Put the card in your computer and find it with `lsblk` (it's `/dev/sdb` below; check, since `dd` overwrites without
asking).

Create the image
```bash
sudo dd if=/dev/sdb of=rc-lap-timer-backup.img bs=4M status=progress
```

Shrink the image
```bash
sudo pishrink.sh rc-lap-timer-backup.img rc-lap-timer-final.img
```
