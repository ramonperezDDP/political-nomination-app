import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Menu, Button, useTheme } from 'react-native-paper';

interface DistrictToggleProps {
  selectedDistrict: string;
  onDistrictChange: (district: string) => void;
}

const DISTRICTS = [
  { id: 'PA-01', label: 'PA-01' },
  { id: 'PA-02', label: 'PA-02' },
];

export default function DistrictToggle({
  selectedDistrict,
  onDistrictChange,
}: DistrictToggleProps) {
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <Menu
      visible={menuVisible}
      onDismiss={() => setMenuVisible(false)}
      anchor={
        <Button
          mode="outlined"
          compact
          onPress={() => setMenuVisible(true)}
          icon="map-marker"
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          {selectedDistrict}
        </Button>
      }
    >
      {DISTRICTS.map((district) => (
        <Menu.Item
          key={district.id}
          onPress={() => {
            onDistrictChange(district.id);
            setMenuVisible(false);
          }}
          title={district.label}
          leadingIcon={
            selectedDistrict === district.id ? 'check' : undefined
          }
        />
      ))}
    </Menu>
  );
}

const styles = StyleSheet.create({
  buttonContent: { height: 36, paddingHorizontal: 12 },
  buttonLabel: { fontSize: 13, marginHorizontal: 4 },
});
