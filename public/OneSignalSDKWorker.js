/**
 * OneSignalSDKWorker.js — Required service worker file for OneSignal Web Push.
 *
 * This file must live at the root of the served domain (/OneSignalSDKWorker.js)
 * so the browser can register it with the full-site scope.
 *
 * The importScripts call loads the actual OneSignal service worker logic from
 * OneSignal's CDN. It must match the SDK version used in the page script.
 *
 * Do not rename or move this file — OneSignal hard-codes this path.
 */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
