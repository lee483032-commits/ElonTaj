# Elon Taj — сохтани Release APK танҳо бо телефон (Termux + GitHub Actions)

## Пеш аз оғоз
- Дар Android Termux ва браузер лозим аст.
- Дар GitHub ҳисоби ройгон созед.
- APK аз GitHub Actions дар абр сохта мешавад; Termux Android SDK/Gradle намесозад.
- Сервер ҳоло ҷойгир нест: APK сохта мешавад, аммо функсияҳои API то ҷойгир кардани backend кор намекунанд.

## 1) ZIP-ро ба Termux биёред
ZIP-и ElonTaj_Android_Starter.zip-ро ба Download гузоред, баъд:

```sh
termux-setup-storage
pkg update -y && pkg upgrade -y
pkg install git nodejs-lts openssl -y
mkdir -p ~/projects && cd ~/projects
unzip ~/storage/downloads/ElonTaj_Android_Starter.zip
cd ElonTaj_Android
```

Агар unzip набошад: `pkg install unzip -y`.

## 2) Калиди имзои Release созед
Ин калидро гум накунед. Файли JKS ва паролҳоро ба касе нафиристед. Нусхаи эҳтиётии JKS-ро дар ҷои амн нигоҳ доред.

```sh
keytool -genkeypair -v -keystore elontaj-release.jks -alias elontaj -keyalg RSA -keysize 2048 -validity 10000
```

Барои GitHub Actions калидро ба Base64 табдил диҳед:

```sh
base64 -w 0 elontaj-release.jks > keystore.base64
```

Агар `base64 -w 0` дастгирӣ нашавад:

```sh
base64 elontaj-release.jks | tr -d '\n' > keystore.base64
```

Паролҳоеро, ки ҳангоми keytool ворид кардед, дар хотир нигоҳ доред.

## 3) Репозиторияи хусусӣ дар GitHub созед
Дар браузер ба https://github.com/new равед. Ном: `ElonTaj-Android`, visibility: **Private**, баъд Create repository.

## 4) Secret-ҳои GitHub илова кунед
Дар репозитория: Settings → Secrets and variables → Actions → New repository secret.
Ин чор secret-ро илова кунед:
- `ANDROID_KEYSTORE_BASE64` — тамоми матни файли `keystore.base64` (бо фармони `cat keystore.base64` бинед; онро дар чат ё ба шахси дигар нафиристед).
- `ANDROID_KEYSTORE_PASSWORD` — пароли keystore.
- `ANDROID_KEY_ALIAS` — `elontaj`.
- `ANDROID_KEY_PASSWORD` — пароли key (агар keytool ҳамон паролро истифода бурд, ҳамонро гузоред).

## 5) Лоиҳаро аз Termux ба GitHub фиристед
Дар `YOUR_GITHUB_NAME` номи ҳисоби GitHub-и худро гузоред:

```sh
git init
git branch -M main
git add .
git commit -m "Prepare Elon Taj Android release"
git remote add origin https://github.com/YOUR_GITHUB_NAME/ElonTaj-Android.git
git push -u origin main
```

GitHub метавонад барои воридшавӣ token талаб кунад; пароли оддии GitHub кор намекунад. Token-ро танҳо дар prompt-и Git ворид кунед, ба касе нафиристед.

## 6) APK-ро гиред
Дар GitHub → репозитория → Actions → `Build Elon Taj Release APK`. Агар workflow худкор оғоз нашуд, Run workflow-ро пахш кунед. Пас аз анҷом, дар натиҷаи сабзи workflow ба поён рафта Artifact-и `ElonTaj-Release-APK`-ро зеркашӣ кунед. ZIP-и artifact-ро кушоед — дар дохилаш `ElonTaj.apk` аст.

## 7) Насб кардан
Дар Android Settings → Install unknown apps барои Files/браузер иҷозат диҳед, баъд `ElonTaj.apk`-ро кушоед.

## Эзоҳ дар бораи сервер
Backend-и аслӣ дар папкаи `backend/` нигоҳ дошта шудааст. Барои кори воқеии барнома онро дар Node.js hosting бо HTTPS ва диски доимӣ ҷойгир кунед. Баъд `public/app-config.js`-ро бо домени воқеии API танзим карда, тағйиротро push кунед ва workflow аз нав APK месозад.
