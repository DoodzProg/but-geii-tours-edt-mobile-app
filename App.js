/**
 * @file Fichier principal de l'application de consultation d'emploi du temps.
 * @author Doodz
 * @date Novembre 2025 - Version finale
 *
 * @description
 * Application complète avec :
 * - Easter Egg logs (6 appuis sur "Menu")
 * - 3 modes d'affichage : Semaine / Semaine & Week-end / Jour
 * - Bouton refresh forcé du calendrier
 * - Logo GitHub cliquable
 * - Nettoyage automatique des logs à la fermeture
 */

// ===============================================================================================
// SECTION : IMPORTS
// ===============================================================================================

import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Modal, useColorScheme, StatusBar, Linking, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import ICAL from 'ical.js';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

// Import de l'API personnalisée pour communiquer avec le service ADE
import { genCalendar, getLogs, clearLogs } from './adeApi'; 

// ===============================================================================================
// SECTION : CONFIGURATION ET CONSTANTES
// ===============================================================================================

// IDs des ressources pour chaque groupe
const groupIDs = {
  'BUT1': { 'A1': 10767, 'A2': 10768, 'B1': 10769, 'B2': 10770, 'C1': 10771, 'C2': 10772, 'D1': 10773, 'D2': 10776, 'M1': 10448 },
  'BUT2': { 'AII1': 10485, 'AII2': 10515, 'EME1': 10896, 'EME2': 11032, 'ESE1': 10464, 'ESE2': 10932 },
  'BUT3': { 'AII1': 10538, 'AII2': 10459, 'EME1': 10982, 'EME2': 11014, 'ESE1': 10969, 'ESE2': 10970 },
};

// Noms des jours pour l'affichage
const daysOfWeekShort = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// Définitions des couleurs pour les thèmes
const themes = {
  light: {
    background: '#fff', text: '#000', topBar: '#f8f8f8', borderColor: '#eee',
    buttonBackground: '#f0f0f0', buttonText: '#000', headerBackground: '#f0f0f0',
    headerText: '#000', todayHeaderBackground: '#444', todayHeaderText: '#fff',
    eventBackground: '#ebebebff', eventBorder: '#c7c7c7ff', eventText: '#333',
    modalBackground: '#fff', modalText: '#000', modalButton: '#ddd',
  },
  dark: {
    background: '#121212', text: '#fff', topBar: '#1f1f1f', borderColor: '#333',
    buttonBackground: '#333', buttonText: '#fff', headerBackground: '#1f1f1f',
    headerText: '#fff', todayHeaderBackground: '#666', todayHeaderText: '#fff',
    eventBackground: '#2a2a2a', eventBorder: '#4a4a4a', eventText: '#fff',
    modalBackground: '#1f1f1f', modalText: '#fff', modalButton: '#444',
  },
};

const APP_VERSION = "v1.3.0"

// ===============================================================================================
// SECTION : FONCTIONS UTILITAIRES
// ===============================================================================================

/**
 * Récupère et parse un fichier iCalendar (.ics) depuis une URL.
 */
async function getIcsEvents(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    const icsText = await response.text();
    const jcalData = ICAL.parse(icsText);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    const events = vevents.map(vevent => {
      const event = new ICAL.Event(vevent);
      const description = vevent.getFirstPropertyValue('description') || '';
      const location = vevent.getFirstPropertyValue('location') || 'Salle inconnue';
      
      let cleanSummary = event.summary;
      
      const typeMatch = cleanSummary.match(/\b(CM|TD|TP)\b/i);
      const courseType = typeMatch ? typeMatch[1].toUpperCase() : 'Autre';
     
      const nameMatch = cleanSummary.match(/\b([A-Z]{2,5}[0-9])\b/i);
      const courseName = nameMatch ? nameMatch[1].toUpperCase() : 'Inconnu';
      
      const groupRegex = /Gr (?:[A-Z]{2,4}[0-9]?|[A-Z][0-9]?)/;
      cleanSummary = cleanSummary.replace(groupRegex, '').trim();

      let fullDescription = description.replace(/\\n/g, '\n').trim();
      
      const descriptionLines = fullDescription.split('\n').filter(line => line.trim() !== '');
      const timeLogLine = descriptionLines.find(line => line.startsWith('(Exported'));
      const teacherLine = descriptionLines[descriptionLines.indexOf(timeLogLine) - 1];
      const groupLines = descriptionLines.slice(0, descriptionLines.indexOf(teacherLine));
      
      return {
        title: cleanSummary, location: location, start: event.startDate.toJSDate(),
        end: event.endDate.toJSDate(), fullDescription: fullDescription, groups: groupLines,
        teacher: teacherLine, timeLog: timeLogLine, courseType, courseName,
      };
    });
    events.sort((a, b) => a.start - b.start);
    return events;
  } catch (error) {
    Alert.alert("Erreur de chargement", "Impossible de charger l'emploi du temps.");
    console.error("Erreur lors de la récupération du fichier .ics :", error);
    return null;
  }
}

/**
 * Détermine la couleur de texte pour un contraste optimal
 */
const getContrastColor = (hexcolor) => {
  if (!hexcolor) return '#000';
  const r = parseInt(hexcolor.substr(1, 2), 16);
  const g = parseInt(hexcolor.substr(3, 2), 16);
  const b = parseInt(hexcolor.substr(5, 2), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000' : '#fff';
};

/**
 * Calcule le numéro de la semaine
 */
const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

// ===============================================================================================
// SECTION : COMPOSANTS MODAUX
// ===============================================================================================

/**
 * @component GroupSelectionModal
 */
const GroupSelectionModal = ({ visible, onClose, onSelectGroup, theme }) => {
  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalBackground === themes.dark.modalBackground ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.modalBackground }]}>
          <Text style={[styles.modalTitle, { color: theme.modalText }]}>Sélectionnez votre groupe</Text>
          <View style={styles.groupTable}>
            {Object.keys(groupIDs).map(year => (
              <View key={year} style={styles.groupColumn}>
                <Text style={[styles.groupYearTitle, { color: theme.modalText }]}>{year}</Text>
                {Object.keys(groupIDs[year]).map(groupName => (
                  <TouchableOpacity key={groupName} style={[styles.groupButton, { backgroundColor: theme.buttonBackground }]} onPress={() => onSelectGroup(year, groupName)}>
                    <Text style={[styles.groupButtonText, { color: theme.buttonText }]}>{groupName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={onClose} style={[styles.backButton, { backgroundColor: theme.modalButton }]}>
              <Text style={[styles.closeButtonText, { color: theme.modalText }]}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: theme.modalButton }]}>
              <Text style={[styles.closeButtonText, { color: theme.modalText }]}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * @component ThemeSelectionModal
 */
const ThemeSelectionModal = ({ visible, onClose, onBack, onSelectTheme, theme, themePreference }) => {
  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalBackground === themes.dark.modalBackground ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.menuContent, { backgroundColor: theme.modalBackground }]}>
          <Text style={[styles.menuTitle, { color: theme.modalText }]}>Thèmes</Text>
          
          <TouchableOpacity style={[styles.menuButton, { backgroundColor: theme.buttonBackground }, themePreference === 'system' && styles.selectedButton]} onPress={() => onSelectTheme('system')}>
            <Text style={[styles.menuButtonText, { color: theme.buttonText }]}>Appareil</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.menuButton, { backgroundColor: theme.buttonBackground }, themePreference === 'light' && styles.selectedButton]} onPress={() => onSelectTheme('light')}>
            <Text style={[styles.menuButtonText, { color: theme.buttonText }]}>Blanc</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuButton, { backgroundColor: theme.buttonBackground }, themePreference === 'dark' && styles.selectedButton]} onPress={() => onSelectTheme('dark')}>
            <Text style={[styles.menuButtonText, { color: theme.buttonText }]}>Noir</Text>
          </TouchableOpacity>
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={onBack} style={[styles.backButton, { backgroundColor: theme.modalButton }]}>
              <Text style={[styles.closeButtonText, { color: theme.modalText }]}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: theme.modalButton }]}>
              <Text style={[styles.closeButtonText, { color: theme.modalText }]}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * @component CourseColorCustomizationModal
 */
const CourseColorCustomizationModal = ({ visible, onClose, onBack, events, courseTypeColors, courseNameColors, onSelectColor, theme, coloringMode, onSetColoringMode }) => {
  const allCourseTypes = ['CM', 'TD', 'TP', 'Autre'];
  const allCourseNames = [...new Set(events.map(event => event.courseName))].sort();
  const availableColors = [
    { name: 'Par défaut', value: null }, { name: 'Bleu ciel', value: '#c9e0ff' },
    { name: 'Rose clair', value: '#ffc9e0' }, { name: 'Vert clair', value: '#c9ffc9' },
    { name: 'Jaune clair', value: '#ffffc9' }, { name: 'Rose saumon', value: '#ffb3c1' },
    { name: 'Vert menthe', value: '#b3ffc1' }, { name: 'Violet clair', value: '#c1b3ff' },
  ];
  const [dropdownVisible, setDropdownVisible] = useState(null);

  const renderDropdown = (item, type, currentColor) => (
    <View style={[styles.dropdownContainer]}>
      <TouchableOpacity style={[styles.dropdownButton, { borderColor: theme.borderColor, backgroundColor: theme.buttonBackground }]} onPress={() => setDropdownVisible(dropdownVisible === item ? null : item)}>
        <Text style={[styles.dropdownButtonText, { color: theme.buttonText, fontSize: 12 }]}>
          {availableColors.find(c => c.value === currentColor)?.name || 'Couleur'}
        </Text>
        <Ionicons name="chevron-down-outline" size={12} color={theme.text} />
      </TouchableOpacity>
      {dropdownVisible === item && (
        <View style={[styles.dropdownList, { backgroundColor: theme.buttonBackground, borderColor: theme.borderColor }]}>
          <ScrollView style={styles.dropdownScrollView}>
            {availableColors.map((colorOption, index) => (
              <TouchableOpacity key={index} style={styles.dropdownItem} onPress={() => { onSelectColor(item, colorOption.value, type); setDropdownVisible(null); }}>
                <View style={[styles.dropdownColor, { backgroundColor: colorOption.value || 'transparent', borderWidth: colorOption.value ? 0 : 1, borderColor: '#888' }]} />
                <Text style={[styles.dropdownText, { color: theme.buttonText }]}>{colorOption.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const renderSingleColumn = (data, type) => (
    <View style={{ width: '100%' }}>
      {data.map(item => (
        <View key={item} style={[styles.colorItem, { borderColor: theme.borderColor }]}>
          <View style={styles.colorItemTextContainer}>
            <Text style={[styles.colorItemText, { color: theme.modalText }]}>{item}</Text>
            <View style={[styles.colorPreview, { backgroundColor: (type === 'type' ? courseTypeColors[item] : courseNameColors[item]) || theme.eventBackground }]} />
          </View>
          {renderDropdown(item, type, (type === 'type' ? courseTypeColors[item] : courseNameColors[item]))}
        </View>
      ))}
    </View>
  );

  const renderTwoColumns = (data, type) => {
    const half = Math.ceil(data.length / 2);
    const firstColumn = data.slice(0, half);
    const secondColumn = data.slice(half);

    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          {firstColumn.map(item => (
            <View key={item} style={[styles.colorItem, { borderColor: theme.borderColor }]}>
              <View style={styles.colorItemTextContainer}>
                <Text style={[styles.colorItemText, { color: theme.modalText }]}>{item}</Text>
                <View style={[styles.colorPreview, { backgroundColor: (type === 'type' ? courseTypeColors[item] : courseNameColors[item]) || theme.eventBackground }]} />
              </View>
              {renderDropdown(item, type, (type === 'type' ? courseTypeColors[item] : courseNameColors[item]))}
            </View>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {secondColumn.map(item => (
            <View key={item} style={[styles.colorItem, { borderColor: theme.borderColor }]}>
              <View style={styles.colorItemTextContainer}>
                <Text style={[styles.colorItemText, { color: theme.modalText }]}>{item}</Text>
                <View style={[styles.colorPreview, { backgroundColor: (type === 'type' ? courseTypeColors[item] : courseNameColors[item]) || theme.eventBackground }]} />
              </View>
              {renderDropdown(item, type, (type === 'type' ? courseTypeColors[item] : courseNameColors[item]))}
            </View>
          ))}
        </View>
      </View>
    );
  };
  
  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalBackground === themes.dark.modalBackground ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.modalBackground }]}>
          <Text style={[styles.modalTitle, { color: theme.modalText }]}>Personnaliser les couleurs</Text>
          <View style={styles.viewToggleContainer}>
            <TouchableOpacity style={[styles.toggleButton, coloringMode === 'type' && styles.toggleButtonActive, { backgroundColor: theme.buttonBackground }]} onPress={() => onSetColoringMode('type')}>
              <Text style={[styles.toggleButtonText, { color: theme.buttonText }]}>Par Type de cours</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleButton, coloringMode === 'name' && styles.toggleButtonActive, { backgroundColor: theme.buttonBackground }]} onPress={() => onSetColoringMode('name')}>
              <Text style={[styles.toggleButtonText, { color: theme.buttonText }]}>Par Matière</Text>
            </TouchableOpacity>
          </View>
          {coloringMode === 'type' ?
            (allCourseTypes.length <= 8 ? renderSingleColumn(allCourseTypes, 'type') : renderTwoColumns(allCourseTypes, 'type'))
            :
            (allCourseNames.length <= 8 ? renderSingleColumn(allCourseNames, 'name') : renderTwoColumns(allCourseNames, 'name'))
          }
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={onBack} style={[styles.backButton, { backgroundColor: theme.modalButton }]}>
              <Text style={[styles.closeButtonText, { color: theme.modalText }]}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: theme.modalButton }]}>
              <Text style={[styles.closeButtonText, { color: theme.modalText }]}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * @component MenuModal
 * MODIFIÉ : Logo GitHub + Bouton Refresh + Easter Egg (6 clics sur "Menu")
 */
const MenuModal = ({ visible, onClose, onOpenPersonalization, onForceRefresh, theme, onMenuTitlePress, tapCount, appVersion }) => { // <-- AJOUTE appVersion ICI
  
  const openGitHub = () => {
    Linking.openURL('https://github.com/DoodzProg/but-geii-tours-edt-mobile-app');
  };

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalBackground === themes.dark.modalBackground ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.menuContent, { backgroundColor: theme.modalBackground }]}>
          
          {/* Header avec logo GitHub et titre Menu */}
          <View style={styles.menuHeader}>
            <TouchableOpacity onPress={openGitHub} style={styles.githubLogo}>
              <Ionicons name="logo-github" size={28} color={theme.modalText} />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={onMenuTitlePress} activeOpacity={1}>
              <Text style={[styles.menuTitle, { color: theme.modalText }]}>Menu</Text>
            </TouchableOpacity>
            
            <View style={{ width: 28 }} />
          </View>

          {/* Affichage du compteur de taps (debug) */}
          {tapCount > 0 && tapCount < 6 && (
            <Text style={[styles.easterEggHint, { color: theme.modalText, opacity: 0.5 }]}>
              {tapCount}/6
            </Text>
          )}
          
          <TouchableOpacity style={[styles.menuButton, { backgroundColor: theme.buttonBackground }]} onPress={onOpenPersonalization}>
            <Text style={[styles.menuButtonText, { color: theme.buttonText }]}>Personnalisation</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuButton, { backgroundColor: theme.buttonBackground, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]} onPress={onForceRefresh}>
            <Ionicons name="refresh-outline" size={20} color={theme.buttonText} style={{ marginRight: 10 }} />
            <Text style={[styles.menuButtonText, { color: theme.buttonText }]}>Actualiser le planning</Text>
          </TouchableOpacity>

          <View style={styles.buttonContainer}>
            <Text style={[styles.versionText, { color: theme.modalText, opacity: 0.6 }]}>
              {appVersion}
            </Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: theme.modalButton }]}>
              <Text style={[styles.closeButtonText, { color: theme.modalText }]}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * @component PersonalizationMenuModal
 */
const PersonalizationMenuModal = ({ visible, onClose, onBack, onOpenThemeSelector, onOpenCourseColorCustomization, onOpenViewSelector, theme }) => {
  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalBackground === themes.dark.modalBackground ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.menuContent, { backgroundColor: theme.modalBackground }]}>
          <Text style={[styles.menuTitle, { color: theme.modalText }]}>Personnalisation</Text>
          <TouchableOpacity style={[styles.menuButton, { backgroundColor: theme.buttonBackground }]} onPress={onOpenThemeSelector}>
            <Text style={[styles.menuButtonText, { color: theme.buttonText }]}>Thèmes (blanc/noir)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuButton, { backgroundColor: theme.buttonBackground }]} onPress={onOpenCourseColorCustomization}>
            <Text style={[styles.menuButtonText, { color: theme.buttonText }]}>Couleurs des cours</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuButton, { backgroundColor: theme.buttonBackground }]} onPress={onOpenViewSelector}>
            <Text style={[styles.menuButtonText, { color: theme.buttonText }]}>Type d'affichage</Text>
          </TouchableOpacity>
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={onBack} style={[styles.backButton, { backgroundColor: theme.modalButton }]}>
              <Text style={[styles.closeButtonText, { color: theme.modalText }]}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: theme.modalButton }]}>
              <Text style={[styles.closeButtonText, { color: theme.modalText }]}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * @component ViewSelectionModal
 * MODIFIÉ : 3 modes (Semaine / Semaine & Week-end / Jour)
 */
const ViewSelectionModal = ({ visible, onClose, onBack, onToggleView, viewMode, theme }) => {
  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalBackground === themes.dark.modalBackground ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.menuContent, { backgroundColor: theme.modalBackground }]}>
          <Text style={[styles.menuTitle, { color: theme.modalText }]}>Choisissez l'affichage</Text>
          
          <TouchableOpacity 
            style={[styles.menuButton, viewMode === 'week' && styles.selectedButton, { backgroundColor: theme.buttonBackground }]} 
            onPress={() => onToggleView('week')}
          >
            <Text style={[styles.menuButtonText, { color: theme.buttonText }]}>Semaine (5j)</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuButton, viewMode === 'fullweek' && styles.selectedButton, { backgroundColor: theme.buttonBackground }]} 
            onPress={() => onToggleView('fullweek')}
          >
            <Text style={[styles.menuButtonText, { color: theme.buttonText }]}>Semaine & Week-end (7j)</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuButton, viewMode === 'day' && styles.selectedButton, { backgroundColor: theme.buttonBackground }]} 
            onPress={() => onToggleView('day')}
          >
            <Text style={[styles.menuButtonText, { color: theme.buttonText }]}>Jour</Text>
          </TouchableOpacity>

          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={onBack} style={[styles.backButton, { backgroundColor: theme.modalButton }]}>
              <Text style={[styles.closeButtonText, { color: theme.modalText }]}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: theme.modalButton }]}>
              <Text style={[styles.closeButtonText, { color: theme.modalText }]}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * @component EventDetailsModal
 */
const EventDetailsModal = ({ visible, onClose, onBack, event, theme }) => {
  if (!event) return null;
  const padZero = (num) => num < 10 ? `0${num}` : num;
  const startTime = `${padZero(event.start.getHours())}:${padZero(event.start.getMinutes())}`;
  const endTime = `${padZero(event.end.getHours())}:${padZero(event.end.getMinutes())}`;
  
  const renderDetailRow = (label, value, isItalic = false) => (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: theme.modalText }]}>{label}</Text>
      <Text style={[styles.detailValue, isItalic && styles.italicText, { color: theme.modalText }]}>{value}</Text>
    </View>
  );
  
  const renderDetailRowWithArray = (label, array) => (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: theme.modalText }]}>{label}</Text>
      <View>
        {array.map((item, index) => (
          <Text key={index} style={[styles.detailValue, { color: theme.modalText }]}>{item}</Text>
        ))}
      </View>
    </View>
  );
  
  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalBackground === themes.dark.modalBackground ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.detailsModalContent, { backgroundColor: theme.modalBackground }]}>
          <Text style={[styles.detailsModalTitle, { color: theme.modalText }]}>Détails du cours</Text>
          {(() => {
            const fullDate = event.start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
            const formattedFullDate = fullDate.charAt(0).toUpperCase() + fullDate.slice(1);
            const numericDate = event.start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

            return (
              <Text style={[styles.detailsModalSubtitle, { color: theme.modalText, alignSelf: 'center', marginBottom: 20, marginTop: -10, fontStyle: 'italic' }]}>
                {formattedFullDate}{' '}{numericDate}
              </Text>
            );
          })()}
          <ScrollView style={styles.detailsScrollView}>
            <View style={styles.detailsTable}>
              {renderDetailRow("Cours", event.title)}
              {renderDetailRow("Horaires", `${startTime} - ${endTime}`)}
              {renderDetailRow("Lieu", event.location)}
              {renderDetailRow("Enseignant", event.teacher)}
              {renderDetailRowWithArray("Groupes", event.groups)}
              {renderDetailRow("Time Log", event.timeLog, true)}
            </View>
          </ScrollView>
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={onBack} style={[styles.backButton, { backgroundColor: theme.modalButton }]}>
              <Text style={[styles.closeButtonText, { color: theme.modalText }]}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: theme.modalButton }]}>
              <Text style={[styles.closeButtonText, { color: theme.modalText }]}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * @component LogsViewerModal
 * MODIFIÉ : Fond blanc forcé pour lisibilité
 */
const LogsViewerModal = ({ visible, onClose, theme }) => {
  const [logs, setLogs] = useState('Chargement des logs...');

  useEffect(() => {
    if (visible) {
      loadLogs();
    }
  }, [visible]);

  const loadLogs = async () => {
    const logContent = await getLogs();
    setLogs(logContent);
  };

  const handleClearLogs = async () => {
    Alert.alert(
      "Effacer les logs",
      "Voulez-vous vraiment supprimer tous les logs ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Effacer", 
          style: "destructive",
          onPress: async () => {
            await clearLogs();
            setLogs('Logs effacés.');
          }
        }
      ]
    );
  };

  const handleCopyLogs = async () => {
    await Clipboard.setStringAsync(logs);
    Alert.alert("Copié", "Les logs ont été copiés dans le presse-papier.");
  };

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
        <View style={[styles.logsModalContent, { backgroundColor: '#fff' }]}>
          <Text style={[styles.modalTitle, { color: '#000' }]}>Logs de l'application 🥚</Text>
          
          <ScrollView style={styles.logsScrollView}>
            <Text style={[styles.logsText, { color: '#000' }]}>{logs}</Text>
          </ScrollView>

          <View style={styles.logsButtonRow}>
            <TouchableOpacity onPress={handleCopyLogs} style={[styles.logsActionButton, { backgroundColor: '#4CAF50' }]}>
              <Ionicons name="copy-outline" size={20} color="#fff" />
              <Text style={styles.logsButtonText}>Copier</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={loadLogs} style={[styles.logsActionButton, { backgroundColor: '#2196F3' }]}>
              <Ionicons name="refresh-outline" size={20} color="#fff" />
              <Text style={styles.logsButtonText}>Actualiser</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleClearLogs} style={[styles.logsActionButton, { backgroundColor: '#F44336' }]}>
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.logsButtonText}>Effacer</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: '#ddd' }]}>
              <Text style={[styles.closeButtonText, { color: '#000' }]}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ===============================================================================================
// SECTION : COMPOSANT PRINCIPAL DE L'APPLICATION
// ===============================================================================================

export function MainApp() {
  // --- ÉTATS (States) ---
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // États pour la navigation dans le calendrier
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [currentDayOffset, setCurrentDayOffset] = useState(0);
  const [viewMode, setViewMode] = useState('week'); // 'week', 'fullweek', 'day'

  // Groupe sélectionné
  const [currentYear, setCurrentYear] = useState('BUT3');
  const [currentGroup, setCurrentGroup] = useState('AII1');
  const [groupHasLoaded, setGroupHasLoaded] = useState(false);
  
  // Thème et personnalisation
  const systemTheme = useColorScheme();
  const [themePreference, setThemePreference] = useState('system');
  const [courseTypeColors, setCourseTypeColors] = useState({});
  const [courseNameColors, setCourseNameColors] = useState({});
  const [coloringMode, setColoringMode] = useState('type');

  // Visibilité des modales
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [personalizationModalVisible, setPersonalizationModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [courseColorModalVisible, setCourseColorModalVisible] = useState(false);
  const [viewSelectionModalVisible, setViewSelectionModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Easter Egg : compteur de taps sur "Menu"
  const [menuTapCount, setMenuTapCount] = useState(0);
  const [tapTimeout, setTapTimeout] = useState(null);
  
  const activeTheme = themePreference === 'system' ? systemTheme : themePreference;
  const theme = themes[activeTheme] || themes.light;
  const insets = useSafeAreaInsets();

  // --- EFFETS DE BORD ---

  // Nettoyage des logs à la fermeture de l'app
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        await clearLogs();
        console.log('Logs effacés (app en arrière-plan)');
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Charger les préférences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('@theme_preference');
        if (savedTheme !== null) setThemePreference(savedTheme);

        const savedColoringMode = await AsyncStorage.getItem('@coloring_mode');
        if (savedColoringMode !== null) setColoringMode(savedColoringMode);

        const savedTypeColors = await AsyncStorage.getItem('@course_type_colors');
        if (savedTypeColors !== null) setCourseTypeColors(JSON.parse(savedTypeColors));

        const savedNameColors = await AsyncStorage.getItem('@course_name_colors');
        if (savedNameColors !== null) setCourseNameColors(JSON.parse(savedNameColors));
        
        const savedYear = await AsyncStorage.getItem('@selected_year');
        const savedGroup = await AsyncStorage.getItem('@selected_group');
        if (savedYear !== null && savedGroup !== null) {
          setCurrentYear(savedYear);
          setCurrentGroup(savedGroup);
        }

        const savedViewMode = await AsyncStorage.getItem('@view_mode');
        if (savedViewMode !== null) setViewMode(savedViewMode);
        
      } catch (e) {
        console.error('Erreur chargement préférences:', e);
      } finally {
        setGroupHasLoaded(true);
      }
    };
    loadPreferences();
  }, []);

  // Récupérer l'emploi du temps
  useEffect(() => {
    if (!groupHasLoaded) return;

    const fetchCalendar = async () => {
      setLoading(true);
      const classeId = groupIDs[currentYear][currentGroup];

      if (!classeId) {
        Alert.alert("Erreur", "Le groupe sélectionné n'a pas d'ID valide.");
        setLoading(false);
        return;
      }

      console.log(`Génération du calendrier pour la classe ID ${classeId}...`);
      const result = await genCalendar(classeId);
      
      if (result.isOffline && !result.url) {
        Alert.alert("Mode hors ligne", "Aucun emploi du temps en cache. Veuillez vous connecter à Internet.");
        setEvents([]);
      } else if (result.isOffline && result.url) {
        Alert.alert("📶 Mode hors ligne", "Affichage du dernier emploi du temps connu.");
        const fetchedEvents = await getIcsEvents(result.url);
        setEvents(fetchedEvents || []);
      } else if (result.url) {
        console.log(`URL obtenue : ${result.url} ${result.fromCache ? '(depuis le cache)' : '(fraîche)'}`);
        const fetchedEvents = await getIcsEvents(result.url);
        setEvents(fetchedEvents || []);
      } else {
        Alert.alert("Erreur", "Impossible de récupérer l'emploi du temps. Consultez les logs pour plus d'informations.");
        setEvents([]);
      }
      
      setLoading(false);
    };
    fetchCalendar();
  }, [currentYear, currentGroup, groupHasLoaded]);

  // --- GESTIONNAIRES D'ÉVÉNEMENTS ---

  const handleGroupSelection = async (year, groupName) => {
    try {
      await AsyncStorage.setItem('@selected_year', year);
      await AsyncStorage.setItem('@selected_group', groupName);
      setCurrentYear(year);
      setCurrentGroup(groupName);
      setGroupModalVisible(false);
      setCurrentWeekOffset(0);
      setCurrentDayOffset(0);
    } catch (e) {
      console.error('Erreur sauvegarde groupe:', e);
    }
  };

  const handleSelectTheme = async (preference) => {
    try {
      await AsyncStorage.setItem('@theme_preference', preference);
      setThemePreference(preference);
    } catch (e) {
      console.error('Erreur sauvegarde thème:', e);
    }
  };

  const handleSelectCourseColor = async (item, color, type) => {
    if (type === 'type') {
      setCourseTypeColors(prev => {
        const newColors = { ...prev, [item]: color };
        AsyncStorage.setItem('@course_type_colors', JSON.stringify(newColors));
        return newColors;
      });
    } else {
      setCourseNameColors(prev => {
        const newColors = { ...prev, [item]: color };
        AsyncStorage.setItem('@course_name_colors', JSON.stringify(newColors));
        return newColors;
      });
    }
  };

  const handleSetColoringMode = async (mode) => {
    try {
      await AsyncStorage.setItem('@coloring_mode', mode);
      setColoringMode(mode);
    } catch (e) {
      console.error('Erreur sauvegarde mode couleur:', e);
    }
  };

  const handleToggleView = async (mode) => {
    try {
      await AsyncStorage.setItem('@view_mode', mode);
      setViewMode(mode);
      if (mode === 'week' || mode === 'fullweek') setCurrentDayOffset(0);
      else setCurrentWeekOffset(0);
    } catch (e) {
      console.error('Erreur sauvegarde mode affichage:', e);
    }
  };

  // NOUVEAU : Forcer le refresh du calendrier
  const handleForceRefresh = async () => {
    Alert.alert(
      "Actualiser le planning",
      "Voulez-vous forcer la mise à jour de votre emploi du temps ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Actualiser",
          onPress: async () => {
            setMenuModalVisible(false);
            setLoading(true);
            
            const classeId = groupIDs[currentYear][currentGroup];
            
            // Supprimer le cache existant
            await AsyncStorage.removeItem(`@url_cache_${classeId}`);
            console.log('Cache supprimé, régénération forcée...');
            
            // Forcer génération
            const result = await genCalendar(classeId);
            
            if (result.url) {
              const fetchedEvents = await getIcsEvents(result.url);
              setEvents(fetchedEvents || []);
              Alert.alert("✅ Succès", "Planning actualisé avec succès !");
            } else {
              Alert.alert("❌ Erreur", "Impossible de régénérer l'emploi du temps.");
            }
            
            setLoading(false);
          }
        }
      ]
    );
  };

  // NOUVEAU : Easter Egg pour les logs (6 taps sur "Menu")
  const handleMenuTitlePress = () => {
    // Annuler le timeout précédent
    if (tapTimeout) {
      clearTimeout(tapTimeout);
    }

    const newCount = menuTapCount + 1;
    setMenuTapCount(newCount);

    if (newCount >= 6) {
      // Ouvrir les logs
      setMenuModalVisible(false);
      setLogsModalVisible(true);
      setMenuTapCount(0);
    } else {
      // Reset après 2 secondes d'inactivité
      const timeout = setTimeout(() => {
        setMenuTapCount(0);
      }, 2000);
      setTapTimeout(timeout);
    }
  };

  // --- LOGIQUE DE RENDU ---

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Chargement de l'emploi du temps...</Text>
      </View>
    );
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Calcul pour les vues "semaine" et "fullweek"
  const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  startOfWeek.setDate(startOfWeek.getDate() - (startOfWeek.getDay() || 7) + 1 + (currentWeekOffset * 7));
  
  const daysToShow = viewMode === 'fullweek' ? 7 : 5; // 7 jours ou 5 jours
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + (daysToShow - 1));

  // Calcul pour la vue "jour"
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  startOfDay.setDate(startOfDay.getDate() + currentDayOffset);
  
  // Filtrage des événements
  const filteredEvents = events.filter(event => {
    const eventDate = new Date(event.start.getFullYear(), event.start.getMonth(), event.start.getDate());
    if (viewMode === 'day') {
      return eventDate.toDateString() === startOfDay.toDateString();
    } else {
      return eventDate >= startOfWeek && eventDate <= endOfWeek;
    }
  });

  // Groupement par jour
  const groupedEvents = filteredEvents.reduce((acc, event) => {
    const day = event.start.getDay();
    if (!acc[day]) acc[day] = [];
    acc[day].push(event);
    return acc;
  }, {});
  
  const startHour = 8;
  const endHour = 20;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  
  const showEventDetails = (event) => {
    setSelectedEvent(event);
    setDetailsModalVisible(true);
  };
  
  const getEventColor = (event) => {
    if (coloringMode === 'type' && courseTypeColors[event.courseType]) {
      return courseTypeColors[event.courseType];
    }
    if (coloringMode === 'name' && courseNameColors[event.courseName]) {
      return courseNameColors[event.courseName];
    }
    return theme.eventBackground;
  };
  
  const padZero = (num) => num < 10 ? `0${num}` : num;
  const currentDay = now.getDay();
  const currentDayIndex = currentDay === 0 ? 7 : currentDay;
  const isCurrentWeek = currentWeekOffset === 0;

  // Rendu du calendrier
  const renderCalendar = () => {
    let weekdays, headerStartDate;
    
    if (viewMode === 'day') {
      weekdays = [daysOfWeekShort[startOfDay.getDay() === 0 ? 6 : startOfDay.getDay() - 1]];
      headerStartDate = startOfDay;
    } else if (viewMode === 'fullweek') {
      weekdays = daysOfWeekShort;
      headerStartDate = startOfWeek;
    } else {
      weekdays = daysOfWeekShort.slice(0, 5); // Lun-Ven
      headerStartDate = startOfWeek;
    }

    return (
      <View style={styles.mainContent}>
        <View style={[styles.weekNavigator, { backgroundColor: theme.topBar, borderColor: theme.borderColor }]}>
          <TouchableOpacity onPress={() => viewMode === 'day' ? setCurrentDayOffset(prev => prev - 1) : setCurrentWeekOffset(prev => prev - 1)}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.weekText, { color: theme.text }]}>
            {viewMode === 'day' ? 
              `${weekdays[0]} ${startOfDay.toLocaleDateString()}` :
              `Semaine n°${getWeekNumber(startOfWeek)} | ${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`
            }
          </Text>
          <TouchableOpacity onPress={() => viewMode === 'day' ? setCurrentDayOffset(prev => prev + 1) : setCurrentWeekOffset(prev => prev + 1)}>
            <Ionicons name="arrow-forward" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={[styles.dayHeadersContainer, { borderColor: theme.borderColor }]}>
          <View style={[styles.timeAxisSpacer, { backgroundColor: theme.headerBackground }]} />
          {weekdays.map((dayName, index) => {
            const dayDate = new Date(headerStartDate);
            dayDate.setDate(headerStartDate.getDate() + (viewMode === 'day' ? 0 : index));
            const formattedDate = `${padZero(dayDate.getDate())}/${padZero(dayDate.getMonth() + 1)}`;
            const dayIndex = dayDate.getDay() === 0 ? 7 : dayDate.getDay();
            const isToday = viewMode !== 'day' && isCurrentWeek && dayIndex === currentDayIndex;
            
            return (
              <View key={index} style={[styles.dayHeader, { flex: 1, backgroundColor: theme.headerBackground }, isToday && { backgroundColor: theme.todayHeaderBackground, borderRadius: 8 }]}>
                <Text style={[styles.dayNameText, { color: theme.headerText }, isToday && { color: theme.todayHeaderText }]}>{dayName}</Text>
                <Text style={[styles.dayDateText, { color: theme.headerText === themes.dark.headerText ? '#fff' : '#555' }, isToday && { color: theme.todayHeaderText }, viewMode === 'fullweek' && { fontSize: 8 }]}>{formattedDate}</Text>
              </View>
            );
          })}
        </View>
        
        <View style={styles.calendarContainer}>
          <View style={[styles.timeAxis, { borderColor: theme.borderColor }]}>
            {hours.map(hour => (
              <View key={hour} style={[styles.hourSlot, { borderColor: theme.borderColor }]}>
                <Text style={[styles.hourText, { color: '#888' }]}>{`${hour}h`}</Text>
              </View>
            ))}
            <View style={styles.halfHourSlot}>
              <Text style={[styles.hourText, { color: '#888' }]}>20h</Text>
            </View>
          </View>
          
          {events.length === 0 ? (
            <View style={styles.noEventsContainer}>
              <Text style={[styles.noEventsText, { color: theme.text }]}>Aucun événement trouvé pour ce groupe.</Text>
              <Text style={[styles.noEventsTextSmall, { color: theme.text }]}>Vérifiez l'URL ou essayez un autre groupe.</Text>
            </View>
          ) : (
            weekdays.map((dayName, index) => {
              const dayDate = new Date(headerStartDate);
              dayDate.setDate(headerStartDate.getDate() + (viewMode === 'day' ? 0 : index));
              const dayIndex = dayDate.getDay();
              
              return (
                <View key={index} style={[styles.dayColumn, { flex: 1, borderColor: theme.borderColor }]}>
                  {groupedEvents[dayIndex]?.map((event, eventIndex) => {
                    const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
                    const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
                    const startOffset = (startMinutes - startHour * 60) * MINUTE_HEIGHT_MULTIPLIER;
                    const duration = (endMinutes - startMinutes) * MINUTE_HEIGHT_MULTIPLIER;
                    const eventBgColor = getEventColor(event);
                    const eventTextColor = getContrastColor(eventBgColor);
                    
                    const eventStyle = {
                      top: startOffset, height: duration, backgroundColor: eventBgColor,
                      borderColor: theme.eventBorder,
                    };
                    
                    return (
                      <TouchableOpacity key={eventIndex} style={[styles.event, eventStyle]} onPress={() => showEventDetails(event)}>
                        <Text style={[styles.eventTime, { color: eventTextColor }]}>
                          {padZero(event.start.getHours())}:{padZero(event.start.getMinutes())} - {padZero(event.end.getHours())}:{padZero(event.end.getMinutes())}
                        </Text>
                        <Text style={[styles.eventTitle, { color: eventTextColor }]}>{event.title}</Text>
                        <Text style={[styles.eventLocation, { color: eventTextColor }]}>{event.location}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  };

const HOUR_HEIGHT = 50; // Hauteur en pixels pour 1 heure
const MINUTE_HEIGHT_MULTIPLIER = HOUR_HEIGHT / 60; // Ratio pixel/minute

  return (
    <>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView style={[styles.appContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.topBar, { backgroundColor: theme.topBar, borderColor: theme.borderColor, paddingTop: insets.top + 15 }]}>
          <TouchableOpacity onPress={() => setMenuModalVisible(true)}>
            <Ionicons name="menu" size={32} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setGroupModalVisible(true)} style={[styles.selectGroupButton, { backgroundColor: activeTheme === 'light' ? '#f0f0f0' : '#333333' }]}>
            <Text style={[styles.groupTitle, { color: theme.text }]}>{currentYear} {currentGroup}</Text>
            <Ionicons name="caret-down-outline" size={18} color={theme.text} style={styles.dropdownIcon} />
          </TouchableOpacity>
          <View style={{ width: 32 }}/>
        </View>

        {renderCalendar()}
        
        
        <MenuModal 
          visible={menuModalVisible} 
          onClose={() => { setMenuModalVisible(false); setMenuTapCount(0); }}
          onOpenPersonalization={() => { 
            setMenuModalVisible(false); 
            setPersonalizationModalVisible(true); 
            setMenuTapCount(0);
          }}
          onForceRefresh={handleForceRefresh}
          theme={theme}
          onMenuTitlePress={handleMenuTitlePress}
          tapCount={menuTapCount}
          appVersion={APP_VERSION}
        />
        
        <PersonalizationMenuModal 
          visible={personalizationModalVisible} 
          onClose={() => setPersonalizationModalVisible(false)} 
          onBack={() => { setPersonalizationModalVisible(false); setMenuModalVisible(true); }} 
          onOpenThemeSelector={() => { setPersonalizationModalVisible(false); setThemeModalVisible(true); }} 
          onOpenCourseColorCustomization={() => { setPersonalizationModalVisible(false); setCourseColorModalVisible(true); }} 
          onOpenViewSelector={() => { setPersonalizationModalVisible(false); setViewSelectionModalVisible(true); }} 
          theme={theme}
        />
        
        <ViewSelectionModal 
          visible={viewSelectionModalVisible} 
          onClose={() => setViewSelectionModalVisible(false)} 
          onBack={() => { setViewSelectionModalVisible(false); setPersonalizationModalVisible(true); }} 
          onToggleView={handleToggleView} 
          viewMode={viewMode} 
          theme={theme}
        />
        
        <ThemeSelectionModal 
          visible={themeModalVisible} 
          onClose={() => setThemeModalVisible(false)} 
          onBack={() => { setThemeModalVisible(false); setPersonalizationModalVisible(true); }} 
          onSelectTheme={handleSelectTheme} 
          theme={theme} 
          themePreference={themePreference}
        />
        
        <CourseColorCustomizationModal 
          visible={courseColorModalVisible} 
          onClose={() => setCourseColorModalVisible(false)} 
          onBack={() => { setCourseColorModalVisible(false); setPersonalizationModalVisible(true); }} 
          events={events} 
          courseTypeColors={courseTypeColors} 
          courseNameColors={courseNameColors} 
          onSelectColor={handleSelectCourseColor} 
          theme={theme} 
          coloringMode={coloringMode} 
          onSetColoringMode={handleSetColoringMode}
        />
        
        <GroupSelectionModal 
          visible={groupModalVisible} 
          onClose={() => setGroupModalVisible(false)} 
          onSelectGroup={handleGroupSelection} 
          theme={theme}
        />
        
        <EventDetailsModal 
          visible={detailsModalVisible} 
          onClose={() => setDetailsModalVisible(false)} 
          onBack={() => setDetailsModalVisible(false)} 
          event={selectedEvent} 
          theme={theme}
        />
        
        <LogsViewerModal 
          visible={logsModalVisible} 
          onClose={() => setLogsModalVisible(false)} 
          theme={theme}
        />
      </ScrollView>
    </>
  );
}



// ===============================================================================================
// SECTION : FEUILLE DE STYLES
// Tous les styles de l'application sont centralisés ici avec StyleSheet.create.
// ===============================================================================================

const styles = StyleSheet.create({
  // --- Conteneurs principaux ---
  appContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainContent: {
    flex: 1,
  },

  // --- Barre supérieure (Top Bar) ---
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
  },

  // Bouton de sélection de classe
  selectGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 170,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
    elevation: 3,
    borderWidth: 0,
  },

  groupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginRight: 5,
  },
  dropdownIcon: {
    marginLeft: 5,
  },

  // --- Navigateur de semaine/jour ---
  weekNavigator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
  },
  weekText: {
    fontWeight: 'bold',
  },
  
  // --- Grille du calendrier ---
  dayHeadersContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  timeAxisSpacer: {
    width: 25,
  },
  dayHeader: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
  },
  dayNameText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  dayDateText: {
    fontSize: 10,
  },
  calendarContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  timeAxis: {
    width: 25,
    borderRightWidth: 1,
  },
  hourSlot: {
    height: 50,
    justifyContent: 'flex-start',
    paddingTop: 5,
    borderBottomWidth: 1,
  },
  halfHourSlot: {
    height: 30,
    justifyContent: 'flex-start',
    paddingTop: 5,
  },
  hourText: {
    fontSize: 10,
    textAlign: 'right',
  },
  dayColumn: {
    flex: 1,
    borderRightWidth: 1,
    position: 'relative',
    height: (20 - 8) * 50 + 30,
  },

  // --- Événements (Cours) ---
  event: {
    position: 'absolute',
    left: 2, right: 2, padding: 2,
    borderRadius: 5, borderWidth: 1,
    justifyContent: 'center', 
    alignItems: 'center',
  },
  eventTime: {
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 2,
  },
  eventTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  eventLocation: {
    fontSize: 8,
    textAlign: 'center',
  },

  // --- Styles des Modales (génériques) ---
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    padding: 20,
    borderRadius: 10,
    width: '95%',
    maxHeight: '80%',
    alignItems: 'center',
  },

  // Modale de détails de l'événement
  detailsModalContent: {
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxWidth: 400,
    alignItems: 'flex-start',
    maxHeight: '85%'
  },
  detailsModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    alignSelf: 'center',
  },
  detailsModalSubtitle: {
    fontSize: 14,
  },
  detailsScrollView: {
  width: '100%',
  flexShrink: 1, 
  marginBottom: 15, 
  },

  //Header Menu avec logo GitHub
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  githubLogo: {
    padding: 5,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },

  //Indicateur Easter Egg
  easterEggHint: {
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },

  versionText: {
    fontSize: 12,
    alignSelf: 'center',
  },

  // Modales de Menu et Personnalisation
  menuContent: {
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },

  // Modale de sélection de groupe
  groupTable: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  groupColumn: {
    flex: 1,
    alignItems: 'center',
  },
  groupYearTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  groupButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginBottom: 5,
    width: '90%',
    alignItems: 'center',
  },
  groupButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  closeButton: {
    padding: 10,
    borderRadius: 5,
  },
  backButton: {
    padding: 10,
    borderRadius: 5,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  menuButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  noEventsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  noEventsText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  noEventsTextSmall: {
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
  },
  detailsTable: {
    width: '100%',
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  detailLabel: {
    fontWeight: 'bold',
    marginRight: 10,
    minWidth: 80,
  },
  detailValue: {
    flexShrink: 1,
  },
  italicText: {
    fontStyle: 'italic',
  },
  selectedButton: {
    borderWidth: 2,
    borderColor: '#66a3ff',
  },

  // Modale de sélection de vue
  viewToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    width: '100%',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 5,
    marginHorizontal: 5,
  },
  toggleButtonActive: {
    borderWidth: 2,
    borderColor: '#66a3ff',
  },
  toggleButtonText: {
    fontWeight: 'bold',
  },

  // Modale de personnalisation des couleurs
  colorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  colorItemText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  colorItemTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  colorPreview: {
    width: 20, height: 20,
    borderRadius: 10, borderWidth: 1,
    borderColor: '#ccc', marginRight: 4,
  },
  dropdownContainer: {
    position: 'relative',
    width: 76,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  dropdownButtonText: {
    flex: 1,
  },
  dropdownList: {
    position: 'absolute',
    top: '100%', left: -80, right: 0,
    borderRadius: 5, borderWidth: 1,
    zIndex: 1000, marginTop: 5,
    maxHeight: 200,
  },
  dropdownScrollView: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  dropdownColor: {
    width: 15, height: 15,
    borderRadius: 7.5,
    marginRight: 10,
  },
  dropdownText: {
    flex: 1,
  },

  // --- NOUVEAUX STYLES POUR LA MODALE LOGS (FOND BLANC FORCÉ) ---
  logsModalContent: {
    padding: 20,
    borderRadius: 10,
    width: '95%',
    height: '80%',
    alignItems: 'center',
  },
  logsScrollView: {
    width: '100%',
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    backgroundColor: '#f5f5f5',
  },
  logsText: {
    fontSize: 10,
    fontFamily: 'monospace',
    lineHeight: 14,
  },
  logsButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 15,
  },
  logsActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 5,
    minWidth: 100,
    justifyContent: 'center',
  },
  logsButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
});

// ===============================================================================================
// SECTION : COMPOSANT RACINE
// Point d'entrée de l'application.
// ===============================================================================================

/**
 * @component App
 * Composant racine qui enveloppe l'application principale dans un SafeAreaProvider.
 * Cela permet de gérer correctement les zones d'affichage spécifiques à chaque appareil
 * (encoches, barres de statut, etc.).
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}