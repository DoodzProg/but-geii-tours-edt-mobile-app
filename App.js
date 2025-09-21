import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
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
      
      let cleanSummary = event.summary.replace(/Gr AII[0-9]?/, '').trim();
      let fullDescription = description.replace(/\\n/g, '\n').trim();

      return {
        title: cleanSummary,
        location: location,
        start: event.startDate.toJSDate(),
        end: event.endDate.toJSDate(),
        fullDescription: fullDescription,
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

// Composant de la modale de sélection de groupe
const GroupSelectionModal = ({ visible, onClose, onSelectGroup }) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Sélectionnez votre groupe</Text>
          <View style={styles.groupTable}>
            {Object.keys(groups).map(year => (
              <View key={year} style={styles.groupColumn}>
                <Text style={styles.groupYearTitle}>{year}</Text>
                {Object.keys(groups[year]).map(groupName => (
                  <TouchableOpacity
                    key={groupName}
                    style={styles.groupButton}
                    onPress={() => onSelectGroup(year, groupName)}
                  >
                    <Text style={styles.groupButtonText}>{groupName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Composant de la modale du menu principal
const MenuModal = ({ visible, onClose, onEditGroups }) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.menuContent}>
          <Text style={styles.menuTitle}>Menu</Text>
          <TouchableOpacity style={styles.menuButton} onPress={onEditGroups}>
            <Text style={styles.menuButtonText}>Ajouter/Modifier un Emploi du temps</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Composant de la modale de modification des groupes
const EditGroupModal = ({ visible, onClose, onUpdateUrl }) => {
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
            <Text style={styles.groupYearTitle}>{year}</Text>
            {Object.keys(groups[year]).map(groupName => (
              <TouchableOpacity
                key={groupName}
                style={styles.groupButton}
                onPress={() => {
                  setSelectedYear(year);
                  setSelectedGroup(groupName);
                }}
              >
                <Text style={styles.groupButtonText}>{groupName}</Text>
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
        <Text style={styles.selectedGroupText}>Groupe sélectionné : {selectedYear} {selectedGroup}</Text>
        <TextInput
          style={styles.urlInput}
          placeholder="Entrez la nouvelle URL ici..."
          value={newUrl}
          onChangeText={setNewUrl}
        />
        <Text style={styles.urlHintText}>
          L'URL doit ressembler à :
          {"\n"}
          "https://ade.univ-tours.fr/XXXXX.shu"
          {"\n\n"}
          <Text style={{fontWeight: 'bold'}}>
            Attention :
          </Text>
          <Text>
            {" Ne pas générer d'URL pour des groupes combinés (1 groupe de TD)."}
          </Text>
        </Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleUpdate}>
          <Text style={styles.saveButtonText}>Sauvegarder l'URL</Text>
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
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Modifier l'Emploi du temps</Text>
          {selectedYear ? renderUrlInput() : renderGroupSelection()}
          <TouchableOpacity onPress={() => { setSelectedYear(null); onClose(); }} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Composant principal de l'application
export default function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [currentYear, setCurrentYear] = useState('BUT3');
  const [currentGroup, setCurrentGroup] = useState('AII1');
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  useEffect(() => {
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
  }, [currentYear, currentGroup]);

  const handleUpdateUrl = (year, groupName, url) => {
    groups[year][groupName] = url;
    setCurrentYear(year);
    setCurrentGroup(groupName);
    setEditModalVisible(false);
    setMenuModalVisible(false);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Chargement de l'emploi du temps...</Text>
      </View>
    );
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 1 + (currentWeekOffset * 7)));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 4);

  const filteredEvents = events.filter(event => {
    const eventDate = new Date(event.start.getFullYear(), event.start.getMonth(), event.start.getDate());
    return eventDate >= startOfWeek && eventDate <= endOfWeek;
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
    Alert.alert(
      event.title,
      event.fullDescription,
      [{ text: "OK" }]
    );
  };

  const handleGroupSelection = (year, groupName) => {
    setCurrentYear(year);
    setCurrentGroup(groupName);
    setGroupModalVisible(false);
    setCurrentWeekOffset(0);
  };

  const padZero = (num) => num < 10 ? `0${num}` : num;

  return (
    <ScrollView style={styles.appContainer}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setMenuModalVisible(true)}>
          <Ionicons name="menu" size={32} color="black" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setGroupModalVisible(true)} style={styles.selectGroupButton}>
          <Text style={styles.groupTitle}>{currentYear} {currentGroup}</Text>
        </TouchableOpacity>
        <View style={{ width: 32 }}/>
      </View>

      <View style={styles.weekNavigator}>
        <TouchableOpacity onPress={() => setCurrentWeekOffset(prev => prev - 1)}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.weekText}>
          Semaine {startOfWeek.toLocaleDateString()} - {endOfWeek.toLocaleDateString()}
        </Text>
        <TouchableOpacity onPress={() => setCurrentWeekOffset(prev => prev + 1)}>
          <Ionicons name="arrow-forward" size={24} color="black" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.mainContent}>
        <View style={styles.dayHeadersContainer}>
          <View style={styles.timeAxisSpacer} />
          {daysOfWeek.map((dayName, dayIndex) => {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(startOfWeek.getDate() + dayIndex);
            const formattedDate = `${padZero(dayDate.getDate())}/${padZero(dayDate.getMonth() + 1)}`;

            return (
              <View key={dayIndex} style={styles.dayHeader}>
                <Text style={styles.dayNameText}>{dayName}</Text>
                <Text style={styles.dayDateText}>{formattedDate}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.calendarContainer}>
          <View style={styles.timeAxis}>
            {hours.map(hour => (
              <View key={hour} style={styles.hourSlot}>
                <Text style={styles.hourText}>{`${hour}:00`}</Text>
              </View>
            ))}
            <View style={styles.halfHourSlot}>
                <Text style={styles.hourText}>18:30</Text>
            </View>
          </View>

          {events.length === 0 ? (
            <View style={styles.noEventsContainer}>
              <Text style={styles.noEventsText}>Aucun événement trouvé pour ce groupe.</Text>
              <Text style={styles.noEventsTextSmall}>Vérifiez l'URL ou essayez un autre groupe.</Text>
            </View>
          ) : (
            daysOfWeek.map((dayName, dayIndex) => (
              <View key={dayIndex} style={styles.dayColumn}>
                {groupedEvents[dayIndex + 1]?.map((event, eventIndex) => {
                  const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
                  const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
                  const startOffset = (startMinutes - startHour * 60) * 1;
                  const duration = (endMinutes - startMinutes) * 1;
  
                  const eventStyle = {
                    top: startOffset,
                    height: duration,
                    backgroundColor: '#c9e0ff',
                    borderColor: '#66a3ff',
                  };
  
                  return (
                    <TouchableOpacity
                      key={eventIndex}
                      style={[styles.event, eventStyle]}
                      onPress={() => showEventDetails(event)}
                    >
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.eventLocation}>{event.location}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
        </View>
      </View>

      <GroupSelectionModal
        visible={groupModalVisible}
        onClose={() => setGroupModalVisible(false)}
        onSelectGroup={handleGroupSelection}
      />
      <MenuModal
        visible={menuModalVisible}
        onClose={() => setMenuModalVisible(false)}
        onEditGroups={() => {
          setMenuModalVisible(false);
          setEditModalVisible(true);
        }}
      />
      <EditGroupModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        onUpdateUrl={handleUpdateUrl}
      />
    </ScrollView>
  );
}

// Styles
const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#fff',
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
    borderColor: '#eee',
  },
  selectGroupButton: {
    width: 150,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    alignItems: 'center',
  },
  groupTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  weekNavigator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
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
    borderColor: '#ccc',
  },
  timeAxisSpacer: {
    width: 35,
    backgroundColor: '#f0f0f0',
  },
  dayHeader: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f0f0f0',
  },
  dayNameText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  dayDateText: {
    fontSize: 10,
    color: '#555',
  },
  calendarContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  timeAxis: {
    width: 35,
    borderRightWidth: 1,
    borderColor: '#ccc',
  },
  hourSlot: {
    height: 60,
    justifyContent: 'flex-start',
    paddingTop: 5,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  halfHourSlot: {
    height: 30,
    justifyContent: 'flex-start',
    paddingTop: 5,
  },
  hourText: {
    fontSize: 8,
    textAlign: 'center',
    color: '#888',
  },
  dayColumn: {
    flex: 1,
    borderRightWidth: 1,
    borderColor: '#ccc',
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
  eventTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  eventLocation: {
    fontSize: 8,
    textAlign: 'center',
    color: '#555',
  },
  // Styles pour les modales
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  menuContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '60%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
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
    backgroundColor: '#f0f0f0',
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
  closeButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#ddd',
    borderRadius: 5,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  menuButton: {
    backgroundColor: '#f0f0f0',
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
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    width: '100%',
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#66a3ff',
    padding: 15,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  scanButton: {
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  urlHintText: {
    fontSize: 12,
    color: '#666',
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
    color: '#888',
    marginTop: 5,
    textAlign: 'center',
  },
});