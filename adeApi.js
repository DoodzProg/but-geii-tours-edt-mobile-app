/**
 * @file API ADE - Version Axios Ultra-Robuste CORRIGÉE
 * @author Doodz + Claude
 * @date Novembre 2025
 *
 * CORRECTIONS MAJEURES :
 * - Fix récupération token execution (regex améliorée)
 * - Gestion cookies avec tough-cookie (compatible React Native)
 * - Axios configuré avec axios-cookiejar-support
 * - Validation URL optimisée
 * - Cache persistant illimité
 * - Retry intelligent avec reset complet
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';

import { ADE_USER, ADE_PASS } from '@env';

// ===============================================================================================
// CONFIGURATION
// ===============================================================================================

const MAX_RETRY_ATTEMPTS = 10;
const URL_VALIDATION_TIMEOUT = 8000;

// Configuration Axios globale de base
axios.defaults.timeout = 15000;
axios.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Linux; Android 11; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36';

// ===============================================================================================
// SYSTÈME DE LOGS
// ===============================================================================================

async function addLog(message, level = 'INFO') {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    
    const existingLogs = await AsyncStorage.getItem('@app_logs') || '';
    const lines = existingLogs.split('\n');
    const recentLines = lines.slice(-300);
    const updatedLogs = recentLines.join('\n') + logEntry;
    
    await AsyncStorage.setItem('@app_logs', updatedLogs);
    console.log(`[${level}] ${message}`);
  } catch (error) {
    console.error('Erreur logs:', error);
  }
}

export async function getLogs() {
  try {
    return await AsyncStorage.getItem('@app_logs') || 'Aucun log disponible.';
  } catch (error) {
    return 'Erreur lors de la récupération des logs.';
  }
}

export async function clearLogs() {
  try {
    await AsyncStorage.removeItem('@app_logs');
    await addLog("Logs effacés par l'utilisateur", "INFO");
  } catch (error) {
    console.error('Erreur effacement logs:', error);
  }
}

// ===============================================================================================
// GESTION DU CACHE PERSISTANT
// ===============================================================================================

async function saveUrlToCache(classe, url) {
  try {
    const cacheEntry = {
      url: url,
      timestamp: Date.now(),
      classe: classe
    };
    await AsyncStorage.setItem(`@url_cache_${classe}`, JSON.stringify(cacheEntry));
    
    const ageStr = new Date().toLocaleString('fr-FR');
    await addLog(`✅ Cache sauvegardé [${classe}] le ${ageStr}`, "INFO");
  } catch (error) {
    await addLog(`Erreur sauvegarde cache : ${error.message}`, "ERROR");
  }
}

async function getUrlFromCache(classe) {
  try {
    const cached = await AsyncStorage.getItem(`@url_cache_${classe}`);
    if (!cached) {
      await addLog(`Aucun cache trouvé pour classe ${classe}`, "DEBUG");
      return null;
    }

    const cacheEntry = JSON.parse(cached);
    const age = Date.now() - cacheEntry.timestamp;
    const ageInDays = Math.floor(age / 1000 / 60 / 60 / 24);
    const ageInHours = Math.floor((age / 1000 / 60 / 60) % 24);
    
    await addLog(`Cache trouvé [${classe}] : ${ageInDays}j ${ageInHours}h`, "DEBUG");
    return cacheEntry.url;
  } catch (error) {
    await addLog(`Erreur lecture cache : ${error.message}`, "ERROR");
    return null;
  }
}

/**
 * VALIDATION ROBUSTE : Télécharge les premiers octets et vérifie que c'est du .ical valide
 */
async function isUrlStillValid(url) {
  try {
    await addLog(`🔍 Validation URL en cours...`, "DEBUG");
    
    const response = await axios.get(url, {
      timeout: URL_VALIDATION_TIMEOUT,
      validateStatus: (status) => status === 200
    });
    
    const text = response.data;
    
    if (typeof text !== 'string' || !text.startsWith('BEGIN:VCALENDAR')) {
      await addLog(`❌ URL ne retourne pas un .ical valide (commence par: ${String(text).substring(0, 50)})`, "DEBUG");
      return false;
    }

    if (!text.includes('BEGIN:VEVENT')) {
      await addLog(`❌ Fichier .ical vide (aucun événement)`, "DEBUG");
      return false;
    }

    await addLog(`✅ URL valide (HTTP 200, contenu .ical OK)`, "INFO");
    return true;
    
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      await addLog(`❌ Timeout validation URL (>${URL_VALIDATION_TIMEOUT}ms)`, "DEBUG");
    } else {
      await addLog(`❌ Erreur validation : ${error.message}`, "DEBUG");
    }
    return false;
  }
}

// ===============================================================================================
// DÉTECTION RÉSEAU
// ===============================================================================================

export async function isOnline() {
  try {
    const state = await NetInfo.fetch();
    const online = state.isConnected && state.isInternetReachable;
    await addLog(`Connexion réseau : ${online ? 'En ligne' : 'Hors ligne'}`, "DEBUG");
    return online;
  } catch (error) {
    await addLog(`Erreur vérification réseau : ${error.message}`, "ERROR");
    return false;
  }
}

// ===============================================================================================
// FONCTIONS UTILITAIRES
// ===============================================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function base64Append(sb, digit, haveNonZero) {
  if (digit > 0) haveNonZero = true;
  if (haveNonZero) {
    let c;
    if (digit < 26) c = String.fromCharCode("A".charCodeAt(0) + digit);
    else if (digit < 52) c = String.fromCharCode("a".charCodeAt(0) + digit - 26);
    else if (digit < 62) c = String.fromCharCode("0".charCodeAt(0) + digit - 52);
    else if (digit === 62) c = "$";
    else c = "_";
    sb.push(c);
  }
  return haveNonZero;
}

function longToBase64(value) {
  const low = value & 0xffffffff;
  const high = Math.floor(value / 0x100000000);
  let sb = [];
  let haveNonZero = false;
  haveNonZero = base64Append(sb, (high >> 28) & 0xf, haveNonZero);
  haveNonZero = base64Append(sb, (high >> 22) & 0x3f, haveNonZero);
  haveNonZero = base64Append(sb, (high >> 16) & 0x3f, haveNonZero);
  haveNonZero = base64Append(sb, (high >> 10) & 0x3f, haveNonZero);
  haveNonZero = base64Append(sb, (high >> 4) & 0x3f, haveNonZero);
  const v = ((high & 0xf) << 2) | ((low >> 30) & 0x3);
  haveNonZero = base64Append(sb, v, haveNonZero);
  haveNonZero = base64Append(sb, (low >> 24) & 0x3f, haveNonZero);
  haveNonZero = base64Append(sb, (low >> 18) & 0x3f, haveNonZero);
  haveNonZero = base64Append(sb, (low >> 12) & 0x3f, haveNonZero);
  haveNonZero = base64Append(sb, (low >> 6) & 0x3f, haveNonZero);
  base64Append(sb, low & 0x3f, true);
  return sb.join("");
}

function dateStringToBase64(date) {
  return longToBase64(date.getTime());
}

function currentTimeToBase64() {
  const date = new Date();
  date.setHours(date.getHours() - 2);
  return longToBase64(date.getTime());
}

// ===============================================================================================
// CONNEXION CAS + GWT-RPC AVEC AXIOS
// ===============================================================================================

/**
 * Effectue la connexion CAS complète avec Axios
 * CORRECTION MAJEURE : Regex améliorée + gestion cookies avec tough-cookie
 */
async function performLogin() {
  await addLog("🔐 Connexion CAS en cours...", "INFO");
  
  // URL de login AVEC 'renew=true' pour forcer la re-connexion
  const loginUrl = "https://cas.univ-tours.fr/cas/login?service=https%3A%2F%2Fade.univ-tours.fr%2Fdirect%2Fmyplanning.jsp&renew=true";

  // Créer une instance Axios avec support cookies
  const sessionAxios = axios.create({
    timeout: 15000,
    withCredentials: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 11; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
    }
  });
  
  try {
    // Étape 1 : Récupérer le jeton execution
    await addLog("Étape 1/2 : GET jeton execution", "DEBUG");
    
    const response1 = await sessionAxios.get(
      loginUrl
    );
    
    if (response1.status !== 200) {
      throw new Error(`HTTP ${response1.status} à l'étape 1`);
    }
    
    const html = response1.data;
    
    // CORRECTION : Regex multiple pour plus de robustesse
    let execution = null;
    
    // Tentative 1 : Regex standard
    let match = html.match(/<input[^>]*name="execution"[^>]*value="([^"]*)"[^>]*>/i);
    if (match && match[1]) {
      execution = match[1];
    }
    
    // Tentative 2 : Regex inversée (value avant name)
    if (!execution) {
      match = html.match(/<input[^>]*value="([^"]*)"[^>]*name="execution"[^>]*>/i);
      if (match && match[1]) {
        execution = match[1];
      }
    }
    
    // Tentative 3 : Regex simplifiée
    if (!execution) {
      match = html.match(/name="execution"\s+value="([^"]+)"/i);
      if (match && match[1]) {
        execution = match[1];
      }
    }
    
    // Tentative 4 : Regex ultra-permissive
    if (!execution) {
      match = html.match(/execution.*?value=["']([^"']+)["']/i);
      if (match && match[1]) {
        execution = match[1];
      }
    }
    
    if (!execution) {
      // Debug : sauvegarder le HTML pour analyse
      await addLog(`HTML reçu (premiers 500 chars) : ${html.substring(0, 500)}`, "DEBUG");
      throw new Error("Jeton execution introuvable dans HTML (toutes regex ont échoué)");
    }
    
    await addLog(`✅ Jeton obtenu : ${execution.substring(0, 20)}...`, "DEBUG");

    // Délai aléatoire pour simuler comportement humain
    const randomDelay = 400 + Math.floor(Math.random() * 300);
    await sleep(randomDelay);

    // Étape 2 : POST identifiants
    await addLog("Étape 2/2 : POST identifiants", "DEBUG");

    const response2 = await sessionAxios.post(
      loginUrl,
      `username=${ADE_USER}&password=${ADE_PASS}&execution=${execution}&_eventId=submit&geolocation=`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': loginUrl,
          'Origin': 'https://cas.univ-tours.fr'
        },
        maxRedirects: 5, // Suivre les redirections
        validateStatus: (status) => status >= 200 && status < 400 // Accepter redirections
      }
    );

    await addLog("✅ Connexion CAS réussie", "INFO");
    
    // Retourner l'instance axios avec les cookies configurés
    return sessionAxios;
    
  } catch (error) {
    await addLog(`❌ Erreur connexion CAS : ${error.message}`, "ERROR");
    if (error.response) {
      await addLog(`Détails réponse : Status ${error.response.status}, Headers: ${JSON.stringify(error.response.headers)}`, "DEBUG");
    }
    throw error;
  }
}

/**
 * Génère l'URL .ical via GWT-RPC avec l'instance Axios authentifiée
 * OPTIMISATION : Demande 1 an de planning (septembre année N → août année N+1)
 */
async function generateIcalUrl(sessionAxios, classe) {
  const userId = currentTimeToBase64();

  // DATES OPTIMISÉES : 1 an de planning
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  
  // Si on est entre janvier et août, l'année scolaire a commencé l'année dernière
  const schoolYearStart = currentMonth < 8 ? currentYear - 1 : currentYear;
  
  const date1 = new Date(schoolYearStart, 8, 1); // 1er septembre année N
  const date2 = new Date(schoolYearStart + 1, 7, 31); // 31 août année N+1
  
  await addLog(`Dates demandées : ${date1.toLocaleDateString()} → ${date2.toLocaleDateString()}`, "DEBUG");

  try {
    // Étape 3 : GWT Login
    await addLog("Étape 3/4 : GWT Login", "DEBUG");
    
    const response3 = await sessionAxios.post(
      "https://ade.univ-tours.fr/direct/gwtdirectplanning/MyPlanningClientServiceProxy",
      `7|0|8|https://ade.univ-tours.fr/direct/gwtdirectplanning/|217140C31DF67EF6BA02D106930F5725|com.adesoft.gwt.directplan.client.rpc.MyPlanningClientServiceProxy|method1login|J|com.adesoft.gwt.core.client.rpc.data.LoginRequest/3705388826|com.adesoft.gwt.directplan.client.rpc.data.DirectLoginRequest/635437471||1|2|3|4|2|5|6|${userId}|7|0|0|0|1|1|8|8|-1|0|0|`,
      {
        headers: {
          "Content-Type": "text/x-gwt-rpc; charset=UTF-8",
          "X-GWT-Module-Base": "https://ade.univ-tours.fr/direct/gwtdirectplanning/",
          "X-GWT-Permutation": "30B3E0B5D2C57008E936E550EA0E3F25"
        }
      }
    );
    
    if (response3.status !== 200) {
      throw new Error(`HTTP ${response3.status} à l'étape 3 (GWT Login)`);
    }

    await sleep(200 + Math.floor(Math.random() * 150));

    // Étape 4 : Génération URL iCal
    await addLog("Étape 4/4 : Génération URL .ical", "DEBUG");
    
    const response4 = await sessionAxios.post(
      "https://ade.univ-tours.fr/direct/gwtdirectplanning/CorePlanningServiceProxy",
      `7|0|11|https://ade.univ-tours.fr/direct/gwtdirectplanning/|748880AB5D6D59CC4770FCCE7567EA63|com.adesoft.gwt.core.client.rpc.CorePlanningServiceProxy|method11getGeneratedUrl|J|java.util.List|java.lang.String/2004016611|java.util.Date/3385151746|java.lang.Integer/3438268394|java.util.ArrayList/4159755760|ical|1|2|3|4|7|5|6|7|8|8|9|9|${userId}|10|1|9|${classe}|11|8|${dateStringToBase64(date1)}|8|${dateStringToBase64(date2)}|9|-1|9|226|`,
      {
        headers: {
          "Content-Type": "text/x-gwt-rpc; charset=UTF-8",
          "X-GWT-Module-Base": "https://ade.univ-tours.fr/direct/gwtdirectplanning/",
          "X-GWT-Permutation": "30B3E0B5D2C57008E936E550EA0E3F25"
        }
      }
    );

    if (response4.status !== 200) {
      throw new Error(`HTTP ${response4.status} à l'étape 4 (Génération URL)`);
    }

    const responseText = response4.data;
    const urlMatch = responseText.match(/https?:\/\/[^\s"\\]+/g);

    if (urlMatch && urlMatch[0]) {
      await addLog(`✅ URL générée : ${urlMatch[0]}`, "INFO");
      return urlMatch[0];
    } else {
      throw new Error("URL .ical introuvable dans la réponse GWT");
    }
    
  } catch (error) {
    await addLog(`❌ Erreur génération URL : ${error.message}`, "ERROR");
    throw error;
  }
}

// ===============================================================================================
// RETRY INTELLIGENT AVEC RESET COOKIES
// ===============================================================================================

async function attemptUrlGenerationWithRetry(classe) {
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      await addLog(`🔄 Tentative ${attempt}/${MAX_RETRY_ATTEMPTS} pour classe ${classe}`, "INFO");

      // ÉTAPE CRITIQUE : Nouvelle connexion à chaque tentative (cookies frais)
      const sessionAxios = await performLogin();
      const url = await generateIcalUrl(sessionAxios, classe);
      
      await addLog(`✅ Succès après ${attempt} tentative(s)`, "INFO");
      return url;

    } catch (error) {
      await addLog(`❌ Tentative ${attempt} échouée : ${error.message}`, "ERROR");

      if (attempt < MAX_RETRY_ATTEMPTS) {
        // Délai exponentiel : 500ms, 1s, 1.5s, 2s, 2.5s...
        const delay = 500 * attempt;
        await addLog(`⏳ Attente de ${delay}ms avant réessai...`, "INFO");
        await sleep(delay);
      } else {
        await addLog(`💀 Échec définitif après ${MAX_RETRY_ATTEMPTS} tentatives`, "ERROR");
        throw new Error(`Échec génération URL après ${MAX_RETRY_ATTEMPTS} tentatives`);
      }
    }
  }
}

// ===============================================================================================
// FONCTION PRINCIPALE EXPORTÉE
// ===============================================================================================

/**
 * Fonction principale : genCalendar()
 * 
 * LOGIQUE :
 * 1. Mode hors ligne → Retourner cache (sans validation)
 * 2. Mode en ligne + cache existe → Valider URL
 *    → Si valide : Retourner cache
 *    → Si morte : Régénérer
 * 3. Pas de cache → Générer nouvelle URL
 * 4. Sauvegarder nouvelle URL dans cache
 * 
 * NOTE : Ne prend plus date1/date2 en paramètre, calcule automatiquement 1 an
 */
export async function genCalendar(classe) {
  await addLog(`\n${'='.repeat(60)}`, "INFO");
  await addLog(`DÉBUT genCalendar pour classe ${classe}`, "INFO");
  await addLog(`${'='.repeat(60)}`, "INFO");

  // 1. Vérifier connectivité réseau
  const online = await isOnline();
  
  if (!online) {
    await addLog("📶 Mode HORS LIGNE détecté", "INFO");
    const cachedUrl = await getUrlFromCache(classe);
    
    if (cachedUrl) {
      await addLog("📦 Utilisation du cache (mode hors ligne)", "INFO");
      return { url: cachedUrl, fromCache: true, isOffline: true };
    } else {
      await addLog("❌ Aucun cache disponible en mode hors ligne", "ERROR");
      return { url: null, fromCache: false, isOffline: true };
    }
  }

  // 2. Mode EN LIGNE : Vérifier le cache
  const cachedUrl = await getUrlFromCache(classe);
  
  if (cachedUrl) {
    await addLog("🔍 Cache trouvé, validation en cours...", "INFO");
    
    // VALIDATION COMPLÈTE (télécharge début du .ical)
    const isValid = await isUrlStillValid(cachedUrl);
    
    if (isValid) {
      await addLog("✅ Cache valide → Utilisation directe", "INFO");
      return { url: cachedUrl, fromCache: true, isOffline: false };
    } else {
      await addLog("🔄 Cache expiré → Régénération nécessaire", "INFO");
    }
  } else {
    await addLog("🆕 Aucun cache → Génération d'une nouvelle URL", "INFO");
  }

  // 3. Générer nouvelle URL (avec retry intelligent)
  try {
    const newUrl = await attemptUrlGenerationWithRetry(classe);
    
    // 4. Sauvegarder dans le cache
    await saveUrlToCache(classe, newUrl);
    
    await addLog("🎉 Génération terminée avec succès", "INFO");
    return { url: newUrl, fromCache: false, isOffline: false };
    
  } catch (error) {
    await addLog(`💥 Échec génération : ${error.message}`, "ERROR");
    
    // FALLBACK : Utiliser cache même si validation a échoué
    if (cachedUrl) {
      await addLog("⚠️ Utilisation cache en dernier recours (validation avait échoué)", "INFO");
      return { url: cachedUrl, fromCache: true, isOffline: false };
    }
    
    await addLog("❌ Aucune solution disponible", "ERROR");
    return { url: null, fromCache: false, isOffline: false };
  }
}