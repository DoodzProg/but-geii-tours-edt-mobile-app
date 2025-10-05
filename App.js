import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Modal, TextInput, useColorScheme, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // AJOUTÉ : Import pour la persistance
import { Ionicons } from '@expo/vector-icons';
import ICAL from 'ical.js';

// Configuration des groupes et de leurs URLs
const groups = {
  'BUT1': {
    'A1': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/Xnma2bnr.shu",
    'A2': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/MYzkvenZ.shu",
    'B1': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/V3LEQ9YA.shu",
    'B2': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/XnmaRqnr.shu",
    'C1': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/OnE9qdnr.shu",
    'C2': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/rY6BLMYz.shu",
    'D1': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/E3pBl5nA.shu",
    'D2': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/5YG4XEnJ.shu",
    'Etrang.': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/rY62peYz.shu",
  },
  'BUT2': {
    'AII1': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/KYNBxkYv.shu",
    'AII2': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/V3LEg2YA.shu",
    'EME1': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/NYab8ynl.shu",
    'EME2': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/v3VgkmYb.shu",
    'ESE1': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/6YPwLQ3v.shu",
    'ESE2': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/LW16pK3a.shu",
  },
  'BUT3': {
    'AII1': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/mWbqKLn2.shu",
    'AII2': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/83D7KwWx.shu",
    'EME1': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/6YPwZZ3v.shu",
    'EME2': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/zWoav7YM.shu",
    'ESE1': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/KYNBxeYv.shu",
    'ESE2': "https://ade.univ-tours.fr/jsp/custom/modules/plannings/ZYja4X3B.shu",
  },
};
// Liste des jours de la semaine
const daysOfWeek = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
// Définition des thèmes
const themes = {
  light: {
    background: '#fff',
    text: '#000',
    topBar: '#f8f8f8',
    borderColor: '#eee',
    buttonBackground: '#f0f0f0',
    buttonText: '#000',
    headerBackground: '#f0f0f0',
    headerText: '#000',
    todayHeaderBackground: '#444',
    todayHeaderText: '#fff',
    eventBackground: '#ebebebff',
    eventBorder: '#c7c7c7ff',
    eventText: '#333',
    modalBackground: '#fff',
    modalText: '#000',
    modalButton: '#ddd',
  },
  dark: {
    background: '#121212',
    text: '#fff',
    topBar: '#1f1f1f',
    borderColor: '#333',
    buttonBackground: '#333',
    buttonText: '#fff',
    headerBackground: '#1f1f1f',
    headerText: '#fff',
    todayHeaderBackground: '#666',
    todayHeaderText: '#fff',
    eventBackground: '#2a2a2a',
    eventBorder: '#4a4a4a',
    eventText: '#fff',
    modalBackground: '#1f1f1f',
    modalText: '#fff',
    modalButton: '#444',
  },
};
// Fonction pour extraire les événements
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
      // Regex pour extraire le type de cours (CM, TD, TP)
      const typeMatch = cleanSummary.match(/\b(CM|TD|TP)\b/i);
      const courseType = typeMatch ? typeMatch[1].toUpperCase() : 'Autre';
     
      // Regex pour extraire le nom de la matière (e.g., OML5, Auto5)
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
        title: cleanSummary,
        location: location,
        start: event.startDate.toJSDate(),
        end: event.endDate.toJSDate(),
        fullDescription: fullDescription,
        groups: groupLines,
       
        teacher: teacherLine,
        timeLog: timeLogLine,
        courseType, // Ajout du type de cours
        courseName, // Ajout du nom de la matière
      };
    });
    events.sort((a, b) => a.start - b.start);
    return events;
  } catch (error) {
    Alert.alert("Erreur de chargement", "Impossible de charger l'emploi du temps. L'URL est peut-être incorrecte ou la connexion internet est indisponible.");
    console.error("Erreur lors de la récupération ou de l'analyse du fichier .ics :", error);
    return null;
  }
}

// Fonction pour déterminer si une couleur est claire ou foncée et renvoyer la couleur de texte appropriée
const getContrastColor = (hexcolor) => {
  if (!hexcolor) return '#000'; // Retourne une couleur par défaut si hexcolor est null
  const r = parseInt(hexcolor.substr(1, 2), 16);
  const g = parseInt(hexcolor.substr(3, 2), 16);
  const b = parseInt(hexcolor.substr(5, 2), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000' : '#fff';
};

// Composant de la modale de sélection de groupe
const GroupSelectionModal = ({ visible, onClose, onSelectGroup, theme }) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalBackground === themes.dark.modalBackground ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.modalBackground }]}>
          <Text style={[styles.modalTitle, { color: theme.modalText }]}>Sélectionnez votre groupe</Text>
          <View style={styles.groupTable}>
            {Object.keys(groups).map(year => (
              <View key={year} style={styles.groupColumn}>
                <Text style={[styles.groupYearTitle, { color: theme.modalText }]}>{year}</Text>
                {Object.keys(groups[year]).map(groupName => (
                  <TouchableOpacity
                    key={groupName}
                    style={[styles.groupButton, { backgroundColor: theme.buttonBackground }]}
                    onPress={() => onSelectGroup(year, groupName)}
                  >
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

// Modale de sélection de thème
const ThemeSelectionModal = ({ visible, onClose, onBack, onSelectTheme, theme, themePreference }) => { // MODIFIÉ : currentTheme renommé en themePreference
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalBackground === themes.dark.modalBackground ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.menuContent, { backgroundColor: theme.modalBackground }]}>
          <Text style={[styles.menuTitle, { color: theme.modalText }]}>Thèmes</Text>
          
          {/* AJOUTÉ : Bouton Appareil/Système */}
          <TouchableOpacity
            style={[styles.menuButton, { backgroundColor: theme.buttonBackground }, themePreference === 'system' && styles.selectedButton]}
            onPress={() => onSelectTheme('system')}
          >
            <Text style={[styles.menuButtonText, { color: theme.buttonText }]}>Appareil</Text>
          </TouchableOpacity>
          
          {/* MODIFIÉ : Bouton Blanc */}
          <TouchableOpacity
            style={[styles.menuButton, { backgroundColor: theme.buttonBackground }, themePreference === 'light' && styles.selectedButton]}
            onPress={() => onSelectTheme('light')}
          >
            <Text style={[styles.menuButtonText, { color: theme.buttonText }]}>Blanc</Text>
          </TouchableOpacity>

          {/* MODIFIÉ : Bouton Noir */}
          <TouchableOpacity
            style={[styles.menuButton, { backgroundColor: theme.buttonBackground }, themePreference === 'dark' && styles.selectedButton]}
            onPress={() => onSelectTheme('dark')}
          >
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

// Composant de la modale de personnalisation des couleurs de cours
const CourseColorCustomizationModal = ({ visible, onClose, onBack, events, courseTypeColors, courseNameColors, onSelectColor, theme, coloringMode, onSetColoringMode }) => {
  const allCourseTypes = ['CM', 'TD', 'TP', 'Autre'];
  const allCourseNames = [...new Set(events.map(event => event.courseName))].sort();
  const availableColors = [
    { name: 'Par défaut', value: null },
    { name: 'Bleu ciel', value: '#c9e0ff' },
    { name: 'Rose clair', value: '#ffc9e0' },
    { name: 'Vert clair', value: '#c9ffc9' },
    { name: 'Jaune clair', value: '#ffffc9' },
    { name: 'Rose saumon', value: '#ffb3c1' },
    { name: 'Vert menthe', value: '#b3ffc1' },
    { name: 'Violet clair', value: '#c1b3ff' },
  ];
  const [dropdownVisible, setDropdownVisible] = useState(null);

  const renderDropdown = (item, type, currentColor) => (
    <View style={[styles.dropdownContainer]}>
      <TouchableOpacity 
        style={[styles.dropdownButton, { borderColor: theme.borderColor, backgroundColor: theme.buttonBackground }]}
        onPress={() => setDropdownVisible(dropdownVisible === item ? null : item)}
      >
        <Text style={[styles.dropdownButtonText, { color: theme.buttonText, fontSize: 12 }]}>
          {availableColors.find(c => c.value === currentColor)?.name || 'Couleur'}
        </Text>
        <Ionicons name="chevron-down-outline" size={12} color={theme.text} />
      </TouchableOpacity>
      {dropdownVisible === item && (
        <View style={[styles.dropdownList, { backgroundColor: theme.buttonBackground, borderColor: theme.borderColor }]}>
          <ScrollView style={styles.dropdownScrollView}>
            {availableColors.map((colorOption, index) => (
              <TouchableOpacity
                key={index}
                style={styles.dropdownItem}
                onPress={() => {
                  onSelectColor(item, colorOption.value, type);
                  setDropdownVisible(null);
                }}
              >
                <View style={[styles.dropdownColor, { backgroundColor: colorOption.value ||
'transparent', borderWidth: colorOption.value ? 0 : 1, borderColor: '#888' }]} />
                <Text style={[styles.dropdownText, { color: theme.buttonText }]}>{colorOption.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  // Fonction pour afficher une seule colonne de cours
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

  // Fonction pour afficher deux colonnes de cours
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
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalBackground === themes.dark.modalBackground ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.modalBackground }]}>
          <Text style={[styles.modalTitle, { color: theme.modalText }]}>Personnaliser les couleurs</Text>
          
          <View style={styles.viewToggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleButton, coloringMode === 'type' && styles.toggleButtonActive, { backgroundColor: theme.buttonBackground }]} 
              onPress={() => onSetColoringMode('type')}
            >
              <Text style={[styles.toggleButtonText, { color: theme.buttonText }]}>Par Type de cours</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleButton, coloringMode === 'name' && styles.toggleButtonActive, { backgroundColor: theme.buttonBackground }]} 
              onPress={() => onSetColoringMode('name')}
            >
              <Text style={[styles.toggleButtonText, { color: theme.buttonText }]}>Par Matière</Text>
            </TouchableOpacity>
          </View>

          {/* Affichage de la liste des cours selon le mode de couleur */}
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

// Modale du menu principal
const MenuModal = ({ visible, onClose, onEditGroups, onOpenPersonalization, theme }) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalBackground === themes.dark.modalBackground ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.menuContent, { backgroundColor: theme.modalBackground }]}>
          <Text style={[styles.menuTitle, { color: theme.modalText }]}>Menu</Text>
          <TouchableOpacity style={[styles.menuButton, { backgroundColor: theme.buttonBackground }]} onPress={onEditGroups}>
            <Text style={[styles.menuButtonText, { color: theme.buttonText }]}>Modifier un planning</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuButton, { backgroundColor: theme.buttonBackground }]} onPress={onOpenPersonalization}>
            <Text style={[styles.menuButtonText, { color: theme.buttonText }]}>Personnalisation</Text>
          </TouchableOpacity>
          <View style={styles.buttonContainer}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: theme.modalButton }]}>
              <Text style={[styles.closeButtonText, { color: theme.modalText }]}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Composant de la modale du menu de personnalisation
const PersonalizationMenuModal = ({ visible, onClose, onBack, onOpenThemeSelector, onOpenCourseColorCustomization, onOpenViewSelector, theme }) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
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
            <Text style={[styles.menuButtonText, { color: theme.buttonText }]}>Planning par semaine / jour</Text>
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

// Composant de la modale de sélection d'affichage
const ViewSelectionModal = ({ visible, onClose, onBack, onToggleView, viewMode, theme }) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalBackground === themes.dark.modalBackground ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.menuContent, { backgroundColor: theme.modalBackground }]}>
          <Text style={[styles.menuTitle, { color: theme.modalText }]}>Choisissez l'affichage</Text>
          <View style={styles.viewToggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleButton, viewMode === 'week' && styles.toggleButtonActive, { backgroundColor: theme.buttonBackground }]} 
              onPress={() => onToggleView('week')}
            >
              <Text style={[styles.toggleButtonText, { color: theme.buttonText }]}>Semaine</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleButton, viewMode === 'day' && styles.toggleButtonActive, { backgroundColor: theme.buttonBackground }]} 
              onPress={() => onToggleView('day')}
            >
              <Text style={[styles.toggleButtonText, { color: theme.buttonText }]}>Jour</Text>
            </TouchableOpacity>
          </View>
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


// Composant de la modale de modification des groupes
const EditGroupModal = ({ visible, onClose, onBack, onUpdateUrl, theme }) => {
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newUrl, setNewUrl] = useState('');
  const handleUpdate = () => {
    if (selectedYear && selectedGroup && newUrl) {
      onUpdateUrl(selectedYear, selectedGroup, newUrl);
      onClose();
    } else {
      Alert.alert("Erreur", "Veuillez sélectionner un groupe et entrer une URL valide.");
    }
  };

  const renderGroupSelection = () => {
    return (
      <View style={styles.groupTable}>
        {Object.keys(groups).map(year => (
          <View key={year} style={styles.groupColumn}>
            <Text style={[styles.groupYearTitle, { color: theme.modalText }]}>{year}</Text>
            {Object.keys(groups[year]).map(groupName => (
              <TouchableOpacity
                key={groupName}
                style={[styles.groupButton, { backgroundColor: theme.buttonBackground }]}
                onPress={() => {
                  setSelectedYear(year);
                  setSelectedGroup(groupName);
                }}
              >
                <Text style={[styles.groupButtonText, { color: theme.buttonText }]}>{groupName}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    );
  };

  const renderUrlInput = () => {
    return (
      <View style={styles.urlInputContainer}>
        <Text style={[styles.selectedGroupText, { color: theme.modalText }]}>Groupe sélectionné : {selectedYear} {selectedGroup}</Text>
        <TextInput
          style={[styles.urlInput, { color: theme.modalText, backgroundColor: theme.background, borderColor: theme.borderColor }]}
          placeholder="Entrez la nouvelle URL ici..."
          placeholderTextColor={theme.text === themes.dark.text ? '#aaa' : '#888'}
          value={newUrl}
          onChangeText={setNewUrl}
        />
        <Text style={[styles.urlHintText, { color: theme.modalText }]}>
          L'URL doit ressembler à :
          {"\n"}
          "https://ade.univ-tours.fr/XXXXX.shu"
          {"\n\n"}
          <Text style={{fontWeight: 'bold'}}>
            Attention :
          </Text>{" Ne pas générer d'URL pour des groupes combinés (1 groupe de TD)."} 
        </Text>
        <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#007BFF' }]} onPress={handleUpdate}>
          <Text style={[styles.saveButtonText, { color: theme.text === themes.dark.text ? '#000' : '#fff' }]}>Sauvegarder l'URL</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalBackground === themes.dark.modalBackground ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.modalBackground }]}>
          <Text style={[styles.modalTitle, { color: theme.modalText }]}>Modifier l'Emploi du temps</Text>
          {selectedYear ? renderUrlInput() : renderGroupSelection()}
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={onBack} style={[styles.backButton, { backgroundColor: theme.modalButton }]}>
              <Text style={[styles.closeButtonText, { color: theme.modalText }]}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setSelectedYear(null); onClose(); }} style={[styles.closeButton, { backgroundColor: theme.modalButton }]}>
              <Text style={[styles.closeButtonText, { color: theme.modalText }]}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Composant pour afficher les détails d'un événement dans un format de tableau
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
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalBackground === themes.dark.modalBackground ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.detailsModalContent, { backgroundColor: theme.modalBackground }]}>
          <Text style={[styles.detailsModalTitle, { color: theme.modalText }]}>Détails du cours</Text>
          <View style={styles.detailsTable}>
            {renderDetailRow("Cours", event.title)}
            {renderDetailRow("Horaires", `${startTime} - ${endTime}`)}
            {renderDetailRow("Lieu", event.location)}
            {renderDetailRow("Enseignant", event.teacher)}
            {renderDetailRowWithArray("Groupes", event.groups)}
            {renderDetailRow("Time Log", event.timeLog, true)}
          </View>
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

// Fonction pour obtenir le numéro de la semaine
const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};
// Composant principal de l'application
export default function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [currentDayOffset, setCurrentDayOffset] = useState(0);
  const [currentYear, setCurrentYear] = useState('BUT3'); // CONSERVER L'ÉTAT INITIAL PAR DÉFAUT
  const [currentGroup, setCurrentGroup] = useState('AII1'); // CONSERVER L'ÉTAT INITIAL PAR DÉFAUT
  const [groupHasLoaded, setGroupHasLoaded] = useState(false); // AJOUTÉ : Pour s'assurer de ne charger les événements qu'après le groupe
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [personalizationModalVisible, setPersonalizationModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [courseColorModalVisible, setCourseColorModalVisible] = useState(false);
  const [viewSelectionModalVisible, setViewSelectionModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  // MODIFIÉ : Nouvelle logique de gestion du thème et persistance
  const systemTheme = useColorScheme(); // 'light' ou 'dark' du système
  const [themePreference, setThemePreference] = useState('system'); // 'system', 'dark', ou 'light' (la préférence de l'utilisateur)
  
  // Détermine le thème actif final
  const activeTheme = themePreference === 'system' ? systemTheme : themePreference;
  const [viewMode, setViewMode] = useState('week');
  // 'week' ou 'day'
  const [courseTypeColors, setCourseTypeColors] = useState({});
  const [courseNameColors, setCourseNameColors] = useState({});
  const [coloringMode, setColoringMode] = useState('type');
  // 'type' ou 'name'
  
  // MODIFIÉ : Utilise activeTheme au lieu de currentTheme
  const theme = themes[activeTheme] || themes.light; 

  // AJOUTÉ : Effet pour charger la préférence de thème ET les couleurs au démarrage
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // 1. Charger le thème
        const savedTheme = await AsyncStorage.getItem('@theme_preference');
        if (savedTheme !== null) {
          setThemePreference(savedTheme);
        }

        // 2. Charger le mode de coloration
        const savedColoringMode = await AsyncStorage.getItem('@coloring_mode');
        if (savedColoringMode !== null) {
          setColoringMode(savedColoringMode);
        }

        // 3. Charger les couleurs par type
        const savedTypeColors = await AsyncStorage.getItem('@course_type_colors');
        if (savedTypeColors !== null) {
          setCourseTypeColors(JSON.parse(savedTypeColors));
        }

        // 4. Charger les couleurs par nom de matière
        const savedNameColors = await AsyncStorage.getItem('@course_name_colors');
        if (savedNameColors !== null) {
          setCourseNameColors(JSON.parse(savedNameColors));
        }
        
        // 5. Charger l'année et le groupe (AJOUTÉ)
        const savedYear = await AsyncStorage.getItem('@selected_year');
        const savedGroup = await AsyncStorage.getItem('@selected_group');
        
        if (savedYear !== null && savedGroup !== null) {
          setCurrentYear(savedYear);
          setCurrentGroup(savedGroup);
        }

        // 6. Charger le mode d'affichage (AJOUTÉ)
        const savedViewMode = await AsyncStorage.getItem('@view_mode');
        if (savedViewMode !== null) {
          setViewMode(savedViewMode);
        }
        
      } catch (e) {
        console.error('Erreur lors du chargement des préférences:', e);
      } finally {
        setGroupHasLoaded(true); // AJOUTÉ : Indique que le chargement initial est terminé
      }
    };
    loadPreferences();
  }, []); // Exécuté une seule fois au montage
  // FIN MODIFICATION LOGIQUE DU THÈME

  useEffect(() => {
    if (!groupHasLoaded) return; // ATTENDRE QUE LE GROUPE SAUVEGARDÉ SOIT CHARGÉ (AJOUTÉ)

    setLoading(true);
    const icsUrl = groups[currentYear][currentGroup];
    getIcsEvents(icsUrl)
      .then(fetchedEvents => {
        if (fetchedEvents) {
          setEvents(fetchedEvents);
        } else {
          setEvents([]);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [currentYear, currentGroup, groupHasLoaded]); // groupHasLoaded ajouté aux dépendances
// ...

  const handleUpdateUrl = (year, groupName, url) => {
    groups[year][groupName] = url;
    setCurrentYear(year);
    setCurrentGroup(groupName);
    setEditModalVisible(false);
    setMenuModalVisible(false);
  };

  // MODIFIÉ : Fonction pour définir et sauvegarder la préférence de thème
  const handleSelectTheme = async (preference) => {
    try {
      await AsyncStorage.setItem('@theme_preference', preference);
      setThemePreference(preference);
    } catch (e) {
      console.error('Erreur lors de la sauvegarde de la préférence de thème:', e);
    }
  };
  // FIN MODIFICATION handleSelectTheme

  const handleSelectCourseColor = async (item, color, type) => {
    if (type === 'type') {
      setCourseTypeColors(prev => {
        const newColors = { ...prev, [item]: color };
        AsyncStorage.setItem('@course_type_colors', JSON.stringify(newColors)); // SAUVEGARDE
        return newColors;
      });
    } else {
      setCourseNameColors(prev => {
        const newColors = { ...prev, [item]: color };
        AsyncStorage.setItem('@course_name_colors', JSON.stringify(newColors)); // SAUVEGARDE
        return newColors;
      });
    }
  };

  const handleSetColoringMode = async (mode) => {
    try {
      await AsyncStorage.setItem('@coloring_mode', mode); // SAUVEGARDE
      setColoringMode(mode);
    } catch (e) {
      console.error('Erreur lors de la sauvegarde du mode de couleur:', e);
    }
  };

  const handleToggleView = (mode) => {
    setViewMode(mode);

    if (mode === 'week') {
      setCurrentDayOffset(0);
    } else {
      setCurrentWeekOffset(0);
    }
  };
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Chargement de l'emploi du temps...</Text>
      </View>
    );
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  startOfWeek.setDate(startOfWeek.getDate() - (startOfWeek.getDay() || 7) + 1 + (currentWeekOffset * 7));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 4);

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  startOfDay.setDate(startOfDay.getDate() + currentDayOffset);
  const endOfDay = new Date(startOfDay);
  const filteredEvents = events.filter(event => {
    const eventDate = new Date(event.start.getFullYear(), event.start.getMonth(), event.start.getDate());
    if (viewMode === 'week') {
      return eventDate >= startOfWeek && eventDate <= endOfWeek;
    } else {
      return eventDate.toDateString() === startOfDay.toDateString();
    }
  });
  const groupedEvents = filteredEvents.reduce((acc, event) => {
    const day = event.start.getDay();
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(event);
    return acc;
  }, {});
  const startHour = 8;
  const endHour = 18;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const showEventDetails = (event) => {
    setSelectedEvent(event);
    setDetailsModalVisible(true);
  };
  const handleGroupSelection = async (year, groupName) => {
    try {
      await AsyncStorage.setItem('@selected_year', year); // SAUVEGARDE
      await AsyncStorage.setItem('@selected_group', groupName); // SAUVEGARDE

      setCurrentYear(year);
      setCurrentGroup(groupName);
      setGroupModalVisible(false);
      setCurrentWeekOffset(0);
      setCurrentDayOffset(0);
    } catch (e) {
      console.error('Erreur lors de la sauvegarde du groupe:', e);
    }
  };
  const padZero = (num) => num < 10 ? `0${num}` : num;
  
  const currentDay = now.getDay();
  const currentDayIndex = currentDay === 0 ? 7 : currentDay;
  const isCurrentWeek = currentWeekOffset === 0;
  const getEventColor = (event) => {
    if (coloringMode === 'type' && courseTypeColors[event.courseType]) {
      return courseTypeColors[event.courseType];
    }
    if (coloringMode === 'name' && courseNameColors[event.courseName]) {
      return courseNameColors[event.courseName];
    }
    return theme.eventBackground;
  };
  
  const renderCalendar = () => {
    const weekdays = viewMode === 'week' ? daysOfWeek : [daysOfWeek[startOfDay.getDay() - 1]];
    const headerStartDate = viewMode === 'week' ? startOfWeek : startOfDay;

    return (
      <View style={styles.mainContent}>
        <View style={[styles.weekNavigator, { backgroundColor: theme.topBar, borderColor: theme.borderColor }]}>
          <TouchableOpacity onPress={() => viewMode === 'week' ? setCurrentWeekOffset(prev => prev - 1) : setCurrentDayOffset(prev => prev - 1)}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.weekText, { color: theme.text }]}>
            {viewMode === 'week' ? 
              `Semaine n°${getWeekNumber(startOfWeek)} | ${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}` :
              `${weekdays[0]} ${startOfDay.toLocaleDateString()}`
            }
          </Text>
          <TouchableOpacity onPress={() => viewMode === 'week' ? setCurrentWeekOffset(prev => prev + 1) : setCurrentDayOffset(prev => prev + 1)}>
            <Ionicons name="arrow-forward" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={[styles.dayHeadersContainer, { borderColor: theme.borderColor }]}>
          <View style={[styles.timeAxisSpacer, { backgroundColor: theme.headerBackground }]} />
          {weekdays.map((dayName, index) => {
            const dayDate = new Date(headerStartDate);
            dayDate.setDate(headerStartDate.getDate() + (viewMode === 'week' ? index : 0));
            
            const formattedDate = `${padZero(dayDate.getDate())}/${padZero(dayDate.getMonth() + 1)}`;
            const isToday = viewMode === 'week' && isCurrentWeek && index + 1 === currentDayIndex;
            return (
              <View key={index} style={[styles.dayHeader, { flex: 1, backgroundColor: theme.headerBackground }, isToday && { backgroundColor: theme.todayHeaderBackground, borderRadius: 8 }]}>
                <Text style={[styles.dayNameText, { color: theme.headerText }, isToday && { color: theme.todayHeaderText }]}>{dayName}</Text>
                <Text style={[styles.dayDateText, { color: theme.headerText === themes.dark.headerText ? '#fff' : '#555' }, isToday && { color: theme.todayHeaderText }]}>{formattedDate}</Text>
              </View>
            );
          })}
        </View>
        
        <View style={styles.calendarContainer}>
          <View style={[styles.timeAxis, { borderColor: theme.borderColor }]}>
            {hours.map(hour => (
              <View key={hour} style={[styles.hourSlot, { borderColor: theme.borderColor }]}>
                <Text style={[styles.hourText, { color: theme.text === themes.dark.text ? '#888' : '#888' }]}>{`${padZero(hour)}:00`}</Text>
              </View>
            ))}
            <View style={styles.halfHourSlot}>
                <Text style={[styles.hourText, { color: theme.text === themes.dark.text ? '#888' : '#888' }]}>18:00</Text>
            </View>
          </View>
          
          {events.length === 0 ?
          (
            <View style={styles.noEventsContainer}>
              <Text style={[styles.noEventsText, { color: theme.text }]}>Aucun événement trouvé pour ce groupe.</Text>
              <Text style={[styles.noEventsTextSmall, { color: theme.text }]}>Vérifiez l'URL ou essayez un autre groupe.</Text>
            </View>
          ) : (
            weekdays.map((dayName, index) => {
              const dayIndex = viewMode === 'week' ? index + 1 : startOfDay.getDay();
              return (
                <View key={index} style={[styles.dayColumn, { flex: 1, borderColor: theme.borderColor }]}>
                  {groupedEvents[dayIndex]?.map((event, eventIndex) => {
                    const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
                    const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
                    const startOffset = (startMinutes - startHour * 60) * 1;
                    const duration = (endMinutes - startMinutes) * 1;
                    const eventBgColor = getEventColor(event);
                    const eventTextColor = getContrastColor(eventBgColor);
                    
                    const eventStyle = {
                      top: startOffset,
                      height: duration,
                      backgroundColor: eventBgColor,
                      borderColor: theme.eventBorder,
                    };
                    return (
                      <TouchableOpacity
                        key={eventIndex}
                        style={[styles.event, eventStyle]}
                        onPress={() => showEventDetails(event)}
                      >
                        <Text style={[styles.eventTime, { color: eventTextColor }]}>{padZero(event.start.getHours())}:{padZero(event.start.getMinutes())} - {padZero(event.end.getHours())}:{padZero(event.end.getMinutes())}</Text>
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

  return (
    <>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView style={[styles.appContainer, { backgroundColor: theme.background }]}>
      <View style={[styles.topBar, { backgroundColor: theme.topBar, borderColor: theme.borderColor }]}>
        <TouchableOpacity onPress={() => setMenuModalVisible(true)}>
          <Ionicons name="menu" size={32} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setGroupModalVisible(true)}
          style={[
            styles.selectGroupButton,
            // MODIFICATION : Couleur manuelle du bouton de groupe (gris clair/gris foncé)
            {
              backgroundColor: activeTheme === 'light' ? '#f0f0f0' : '#333333', // Gris clair pour le thème blanc, Gris foncé pour le thème noir
            },
          ]}
        >
          <Text style={[styles.groupTitle, { color: theme.text }]}>{currentYear} {currentGroup}</Text>
          <Ionicons name="caret-down-outline" size={18} color={theme.text} style={styles.dropdownIcon} />
        </TouchableOpacity>
        <View style={{ width: 32 }}/>
      </View>

      {renderCalendar()}
      
      <GroupSelectionModal
        visible={groupModalVisible}
        onClose={() => setGroupModalVisible(false)}
        onSelectGroup={handleGroupSelection}
        theme={theme}
      />
      <MenuModal
        visible={menuModalVisible}
        onClose={() => setMenuModalVisible(false)}
        onEditGroups={() => {
          setMenuModalVisible(false);
          setEditModalVisible(true);
        }}
        onOpenPersonalization={() => {
          setMenuModalVisible(false);
          setPersonalizationModalVisible(true);
        }}
        theme={theme}
      />
      <PersonalizationMenuModal
        visible={personalizationModalVisible}
        onClose={() => setPersonalizationModalVisible(false)}
        onBack={() => {
          setPersonalizationModalVisible(false);
          setMenuModalVisible(true);
        }}
        onOpenThemeSelector={() => {
          setPersonalizationModalVisible(false);
          setThemeModalVisible(true);
        }}
        onOpenCourseColorCustomization={() => {
          setPersonalizationModalVisible(false);
          setCourseColorModalVisible(true);
        }}
        onOpenViewSelector={() => {
          setPersonalizationModalVisible(false);
          setViewSelectionModalVisible(true);
        }}
        theme={theme}
      />
      <ViewSelectionModal
        visible={viewSelectionModalVisible}
        onClose={() => setViewSelectionModalVisible(false)}
        onBack={() => {
          setViewSelectionModalVisible(false);
          setPersonalizationModalVisible(true);
        }}
        onToggleView={handleToggleView}
        viewMode={viewMode}
        theme={theme}
      />
      <EditGroupModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        onBack={() => {
          setEditModalVisible(false);
          setMenuModalVisible(true);
        }}
        onUpdateUrl={handleUpdateUrl}
        theme={theme}
      />
      <ThemeSelectionModal
        visible={themeModalVisible}
        onClose={() => setThemeModalVisible(false)}
        onBack={() => {
          setThemeModalVisible(false);
          setPersonalizationModalVisible(true);
        }}
        onSelectTheme={handleSelectTheme}
        theme={theme}
        themePreference={themePreference} // MODIFIÉ : Passe la préférence au lieu du thème actuel
      />
      <CourseColorCustomizationModal
        visible={courseColorModalVisible}
        onClose={() => setCourseColorModalVisible(false)}
        onBack={() => {
          setCourseColorModalVisible(false);
          setPersonalizationModalVisible(true);
        }}
        events={events}
        courseTypeColors={courseTypeColors}
        courseNameColors={courseNameColors}
        onSelectColor={handleSelectCourseColor}
        theme={theme}
        coloringMode={coloringMode}
        onSetColoringMode={handleSetColoringMode}
      />
      <EventDetailsModal
        visible={detailsModalVisible}
        onClose={() => setDetailsModalVisible(false)}
        onBack={() => {
          setDetailsModalVisible(false);
          // Pas de modale précédente pour le retour ici, donc on ferme
        }}
        event={selectedEvent}
        theme={theme}
      />
    </ScrollView>
    </>
  );
}

// Styles
const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  selectGroupButton: { // MODIFIÉ
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
  dropdownIcon: { // AJOUTÉ
    marginLeft: 5,
  },
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
  mainContent: {
    flex: 1,
  },
  dayHeadersContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  timeAxisSpacer: {
    width: 35,
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
    width: 35,
    borderRightWidth: 1,
  },
  hourSlot: {
    height: 60,
    justifyContent: 'flex-start',
    paddingTop: 5,
    borderBottomWidth: 1,
  },
  halfHourSlot: {
    height: 60,
    justifyContent: 'flex-start',
    paddingTop: 5,
  },
  hourText: {
    fontSize: 8,
    textAlign: 'center',
  },
  dayColumn: {
    flex: 1,
    borderRightWidth: 1,
    position: 'relative',
    height: (18 - 8) * 60 + 30,
  },
  event: {
    position: 'absolute',
    left: 2,
    right: 2,
    padding: 2,
    borderRadius: 5,
    borderWidth: 1,
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
  // Styles pour les modales
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
  detailsModalContent: {
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxWidth: 400,
    alignItems: 'flex-start',
  },
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
  detailsModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    alignSelf: 'center',
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
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
  // Nouveaux styles pour les boutons en bas des modales
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
  urlInputContainer: {
    width: '100%',
    alignItems: 'center',
  },
  selectedGroupText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    width: '100%',
    marginBottom: 10,
  },
  saveButton: {
    padding: 15,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    fontWeight: 'bold',
  },
  scanButton: {
    padding: 15,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
  },
  scanButtonText: {
    fontWeight: 'bold',
  },
  urlHintText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 18,
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
  // Nouveaux styles pour les détails de l'événement
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
  // Nouveau style pour le bouton de thème sélectionné
  selectedButton: {
    borderWidth: 2,
    borderColor: '#66a3ff',
  },
  // Nouveaux styles pour la personnalisation
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
  colorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  colorItemTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  colorOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flex: 2,
  },
  colorOptionButton: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    marginHorizontal: 3,
    borderWidth: 1,
  },
  colorPreview: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    marginRight: 4,
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
    top: '100%',
    left: -80,
    right: 0,
    borderRadius: 5,
    borderWidth: 1,
    zIndex: 1000, // Make this menu appear on top of other elements
    marginTop: 5,
    maxHeight: 200,
  },
  dropdownScrollView: {
    maxHeight: 200, // Add this to make the dropdown list scrollable
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  dropdownColor: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    marginRight: 10,
  },
  dropdownText: {
    flex: 1,
  },
});