/* ============================================================
   cloud-sync.js — optional login + cross-device sync (Firebase)

   This is entirely optional. Without a Firebase project configured,
   every function here is a safe no-op and the app behaves exactly as
   it did before: fully offline, local-storage only.

   Setup: see README.md "Cloud Backup & Multi-Device Sync" section.
   ============================================================ */

let fbApp = null, fbAuth = null, fbDb = null;
let currentUser = null;
let pushTimers = {}; // per-project debounce timers
let syncStatus = 'offline'; // 'offline' | 'signed-out' | 'syncing' | 'synced' | 'error'
let lastSyncError = null;

function cloudConfigured() {
  return !!(window.FIREBASE_CONFIG &&
    window.FIREBASE_CONFIG.apiKey &&
    !String(window.FIREBASE_CONFIG.apiKey).startsWith('YOUR_'));
}

function cloudSdkLoaded() {
  return typeof firebase !== 'undefined';
}

function initCloud() {
  if (!cloudConfigured() || !cloudSdkLoaded()) {
    syncStatus = 'offline';
    return;
  }
  try {
    fbApp = firebase.initializeApp(window.FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    // Let the app keep working fully offline; Firestore queues writes locally
    // and flushes them when connectivity returns.
    fbDb.enablePersistence({ synchronizeTabs: true }).catch(() => {});

    fbAuth.onAuthStateChanged(async (user) => {
      currentUser = user;
      syncStatus = user ? 'syncing' : 'signed-out';
      if (window.onCloudAuthChanged) window.onCloudAuthChanged(user);
      if (user) {
        await pullAndMergeProjects();
        syncStatus = 'synced';
        if (window.onCloudAuthChanged) window.onCloudAuthChanged(user);
      }
    });

    onProjectSaved((project) => scheduleCloudPush(project));
    onProjectDeleted((projectId) => deleteCloudProject(projectId));
  } catch (e) {
    console.error('Firebase init failed', e);
    syncStatus = 'error';
    lastSyncError = e.message;
  }
}

function scheduleCloudPush(project) {
  if (!currentUser || !getAutoSyncPref()) return;
  clearTimeout(pushTimers[project.id]);
  pushTimers[project.id] = setTimeout(() => pushProject(project), 1200);
}

async function pushProject(project) {
  if (!currentUser || !fbDb) return;
  try {
    await fbDb.collection('users').doc(currentUser.uid).collection('projects').doc(project.id).set(project);
    syncStatus = 'synced';
  } catch (e) {
    console.error('cloud push failed', e);
    syncStatus = 'error';
    lastSyncError = e.message;
  }
}

async function deleteCloudProject(projectId) {
  if (!currentUser || !fbDb) return;
  try {
    await fbDb.collection('users').doc(currentUser.uid).collection('projects').doc(projectId).delete();
  } catch (e) { console.error('cloud delete failed', e); }
}

// Pulls every cloud project for this user and merges into local storage.
// Conflict rule: whichever copy (local vs cloud) has the newer `updatedAt`
// wins — simple last-write-wins, fine for one person using a couple of
// devices rather than concurrent multi-user editing.
async function pullAndMergeProjects() {
  if (!currentUser || !fbDb) return;
  try {
    const snap = await fbDb.collection('users').doc(currentUser.uid).collection('projects').get();
    const root = getRoot();
    let changed = false;
    snap.forEach(doc => {
      const cloudProj = doc.data();
      const local = root.projects[cloudProj.id];
      if (!local || new Date(cloudProj.updatedAt || 0) > new Date(local.updatedAt || 0)) {
        root.projects[cloudProj.id] = cloudProj;
        changed = true;
      }
    });
    // Anything local that isn't in the cloud yet (e.g. created while signed
    // out) should be pushed up rather than left behind.
    Object.values(root.projects).forEach(p => {
      const inCloud = snap.docs.some(d => d.id === p.id);
      if (!inCloud) pushProject(p);
    });
    if (changed) {
      if (!root.activeProjectId) root.activeProjectId = Object.keys(root.projects)[0] || null;
      saveRoot(root);
    }
  } catch (e) {
    console.error('cloud pull failed', e);
    syncStatus = 'error';
    lastSyncError = e.message;
  }
}

async function pushAllProjectsNow() {
  const root = getRoot();
  await Promise.all(Object.values(root.projects).map(p => pushProject(p)));
}

async function cloudSignUp(email, password) {
  if (!fbAuth) throw new Error('Cloud sync is not set up yet — see README.md.');
  return fbAuth.createUserWithEmailAndPassword(email, password);
}
async function cloudSignIn(email, password) {
  if (!fbAuth) throw new Error('Cloud sync is not set up yet — see README.md.');
  return fbAuth.signInWithEmailAndPassword(email, password);
}
async function cloudSignOut() {
  if (!fbAuth) return;
  return fbAuth.signOut();
}
function getCurrentCloudUser() { return currentUser; }
function getSyncStatus() { return { status: syncStatus, error: lastSyncError }; }

function getAutoSyncPref() { return localStorage.getItem('boq_autosync_pref') !== 'off'; }
function setAutoSyncPref(on) { localStorage.setItem('boq_autosync_pref', on ? 'on' : 'off'); }
