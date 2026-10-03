# Pantry

An accessible, inventory-first bakery assistant (React Native MVP, formerly "Grandma's Order Desk"): ingredients and expiry
tracking, batch production, missing-ingredient supplier suggestions (fictional
demo prices), quick sales, daily cash/card closing, and sales insights.

- Three sections in a left sidebar: Home, Inventory, Sales (no navigation library). Design: white and #FFF9E1 surfaces, #AB4343 actions, #597549 good statuses, Inter text with Fredoka headings, nothing under 24 px.
- State: React context + pure transition functions in `src/logic/`, persisted with AsyncStorage (browser localStorage on the web).
- Demo data is seeded on first launch relative to today; reset it from the Home tab.

It's built to run as a website on computers and iPads (react-native-web + Vite).

```sh
npm install
npm run web          # dev server at http://127.0.0.1:5173
npm run web:build    # static build in dist-web/
npm test && npx tsc --noEmit && npm run lint
```

## Vendor search (in Inventory)

Open it from **Find other vendors** in Inventory's Shopping help, or **See other
options** on a "Biggest cost" tip in Sales. Type an ingredient to get:

- **Types on the market**: 2–3 kinds and what people often say each is good
  for, with sources (Claude + web search).
- **Your picks near you**: up to three stores, each good at something
  different: local & natural, best for bulk (chains get "check price online"
  instead of an email), and closest (Google Places).
- **Email drafts** with real weekly volume and a seasonal-price question,
  opened in Grandma's own mail app. Paste a reply to save a dated quote, shown
  as cost per treat and $/month.

It works offline with fictional sample stores (marked "Sample"). For live
results, run the small server in `server/`, which holds the API keys so they
never ship inside the app:

```sh
cd server
npm install
cp .env.example .env   # add ANTHROPIC_API_KEY and GOOGLE_MAPS_API_KEY
npm run dev            # http://127.0.0.1:8787
```

The app tries the server first (`src/services/config.ts`) and falls back to the
sample data whenever it is off, slow or missing a key. The website calls the
server on the same host it was opened from; the server only answers websites
listed in `ALLOWED_ORIGINS` (default: the Pantry dev site on port 5173). On a physical phone, set
`HOST=0.0.0.0` in `.env` and point `API_BASE_URL` at your computer's Wi-Fi
address.

---

This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
