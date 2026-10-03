# Elon Taj — сохтани APK (Release)

## Муҳим: серверро аввал дар интернет ҷойгир кунед
Ин APK интерфейси вебро дар дохили Android нигоҳ медорад, аммо API ва базаи SQLite дар сервер мемонанд. Барои кор кардани воридшавӣ, эълонҳо ва аксҳо сервер бояд бо HTTPS дастрас бошад ва диски доимӣ дошта бошад.

### 1. Ҷойгир кардани backend
1. Дар хостинги Node.js лоиҳаи аслии `server.js`, `package.json` ва `public/`-ро ҷойгир кунед.
2. Фармони build лозим нест; Start command: `npm start`.
3. Node.js 20+ истифода баред.
4. `JWT_SECRET`-и тасодуфии дароз таъин кунед.
5. `DATA_DIR`-ро ба диски persistent равона кунед.
6. HTTPS фаъол кунед.
7. Санҷед, ки `https://DOMAIN/api/ads` ҷавоб медиҳад (ё endpoint-и рӯйхати эълонҳо мувофиқи сервер).

### 2. Пайваст кардани APK ба сервер
Дар `public/app-config.js` суроғаи origin-ро гузоред, бе `/` дар охир:

```js
window.ELON_TAJ_API_BASE = 'https://DOMAIN';
```

Масалан `https://elon-taj.example.com`. Ин суроға намунавӣ аст; домени воқеии худро истифода баред.

### 3. Сохтани Android project (дар компютер)
Талабот: Node.js 20+, JDK 17, Android Studio ва Android SDK.

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```

Дар Android Studio: **Build → Generate Signed Bundle / APK → APK**. Барои сохтани release keystore эҷод кунед, маълумоташро махфӣ нигоҳ доред, баъд **release**-ро интихоб карда Finish занед.

Файли APK одатан дар ин ҷо мешавад:
`android/app/build/outputs/apk/release/app-release.apk`

### 4. Санҷиш
APK-ро дар телефон насб карда, интернетро фаъол кунед. Сабти ном, воридшавӣ, рӯйхати эълонҳо, бор кардани акс ва кушодани аксҳоро санҷед.

## Агар танҳо Termux дошта бошед
Termux барои насби Node.js ва омода кардани файлҳо хуб аст, аммо Android SDK/Gradle ва имзокунии release APK дар худи телефон кори вазнин ва аксар вақт мушкил аст. Роҳи боэътимод: папкаи мазкурро ба компютер гузаронед ва бо Android Studio APK созед.

## Маълумоти баста
- Номи барнома: Elon Taj
- Application ID: `com.elontaj.app`
- Натиҷаи дилхоҳ: Release APK
- UI: `public/`
- Backend: лоиҳаи аслии Elon Taj, алоҳида дар Node.js hosting
