import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal, Portal, Text, Button, useTheme } from 'react-native-paper';
import Svg, { Path, G, Text as SvgText } from 'react-native-svg';

interface LocationMapModalProps {
  visible: boolean;
  onDismiss: () => void;
  onLocationSelect: (locationId: string) => void;
  district: string;
}

const PA01_ZONES = [
  { id: 'pa01-north', label: 'North', path: 'M50,10 L150,10 L150,80 L50,80 Z', center: { x: 100, y: 45 } },
  { id: 'pa01-central', label: 'Central', path: 'M50,80 L150,80 L150,150 L50,150 Z', center: { x: 100, y: 115 } },
  { id: 'pa01-south', label: 'South', path: 'M50,150 L150,150 L150,220 L50,220 Z', center: { x: 100, y: 185 } },
];

const PA02_ZONES = [
  { id: 'pa02-west', label: 'West Philly', path: 'M10,50 L90,50 L90,180 L10,180 Z', center: { x: 50, y: 115 } },
  { id: 'pa02-center', label: 'Center City', path: 'M90,50 L170,50 L170,180 L90,180 Z', center: { x: 130, y: 115 } },
  { id: 'pa02-northeast', label: 'Northeast', path: 'M170,10 L250,10 L250,120 L170,120 Z', center: { x: 210, y: 65 } },
  { id: 'pa02-south', label: 'South Philly', path: 'M90,180 L200,180 L200,240 L90,240 Z', center: { x: 145, y: 210 } },
];

export default function LocationMapModal({
  visible,
  onDismiss,
  onLocationSelect,
  district,
}: LocationMapModalProps) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const theme = useTheme();
  const zones = district === 'PA-02' ? PA02_ZONES : PA01_ZONES;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContent}
      >
        <Text variant="titleLarge" style={styles.title}>
          {district} — Select Area
        </Text>
        <Text variant="bodySmall" style={styles.subtitle}>
          Tap a zone to see candidates from that area
        </Text>

        <View style={styles.mapContainer}>
          <Svg width="100%" height={260} viewBox="0 0 260 260">
            {zones.map((zone) => {
              const isSelected = selectedZone === zone.id;
              return (
                <G key={zone.id}>
                  <Path
                    d={zone.path}
                    fill={isSelected ? theme.colors.primaryContainer : '#e8e8e8'}
                    stroke={isSelected ? theme.colors.primary : '#999'}
                    strokeWidth={isSelected ? 2.5 : 1}
                    onPress={() => setSelectedZone(zone.id)}
                  />
                  <SvgText
                    x={zone.center.x}
                    y={zone.center.y}
                    textAnchor="middle"
                    fontSize={11}
                    fill={isSelected ? theme.colors.primary : '#555'}
                    fontWeight={isSelected ? 'bold' : 'normal'}
                  >
                    {zone.label}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </View>

        <View style={styles.actions}>
          <Button mode="outlined" onPress={onDismiss}>
            Cancel
          </Button>
          <Button
            mode="contained"
            disabled={!selectedZone}
            onPress={() => {
              if (selectedZone) {
                onLocationSelect(selectedZone);
                onDismiss();
              }
            }}
          >
            Show Candidates
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  mapContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
});
