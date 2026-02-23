import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Avatar as PaperAvatar, useTheme } from 'react-native-paper';

interface AvatarProps {
  size?: number;
  style?: ViewStyle;
}

interface AvatarImageProps extends AvatarProps {
  source: string;
}

interface AvatarTextProps extends AvatarProps {
  label: string;
  color?: string;
  labelColor?: string;
}

interface AvatarIconProps extends AvatarProps {
  icon: string;
  color?: string;
}

export function AvatarImage({ source, size = 48, style }: AvatarImageProps) {
  return (
    <PaperAvatar.Image
      source={{ uri: source }}
      size={size}
      style={style}
    />
  );
}

export function AvatarText({
  label,
  size = 48,
  color,
  labelColor,
  style,
}: AvatarTextProps) {
  const theme = useTheme();

  return (
    <PaperAvatar.Text
      label={label}
      size={size}
      style={StyleSheet.flatten([{ backgroundColor: color || theme.colors.primary }, style])}
      labelStyle={{ color: labelColor || theme.colors.onPrimary }}
    />
  );
}

export function AvatarIcon({ icon, size = 48, color, style }: AvatarIconProps) {
  const theme = useTheme();

  return (
    <PaperAvatar.Icon
      icon={icon}
      size={size}
      style={StyleSheet.flatten([{ backgroundColor: color || theme.colors.primary }, style])}
    />
  );
}

interface UserAvatarProps {
  photoUrl?: string;
  displayName: string;
  size?: number;
  style?: ViewStyle;
}

export function UserAvatar({ photoUrl, displayName, size = 48, style }: UserAvatarProps) {
  if (photoUrl) {
    return <AvatarImage source={photoUrl} size={size} style={style} />;
  }

  // Get initials from display name
  const initials = displayName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return <AvatarText label={initials} size={size} style={style} />;
}

interface AvatarGroupProps {
  avatars: { photoUrl?: string; displayName: string }[];
  maxDisplay?: number;
  size?: number;
  style?: ViewStyle;
}

export function AvatarGroup({
  avatars,
  maxDisplay = 3,
  size = 32,
  style,
}: AvatarGroupProps) {
  const displayAvatars = avatars.slice(0, maxDisplay);
  const remaining = avatars.length - maxDisplay;

  return (
    <View style={StyleSheet.flatten([styles.avatarGroup, style])}>
      {displayAvatars.map((avatar, index) => (
        <View
          key={index}
          style={StyleSheet.flatten([
            styles.avatarGroupItem,
            { marginLeft: index > 0 ? -size / 3 : 0, zIndex: maxDisplay - index },
          ])}
        >
          <UserAvatar
            photoUrl={avatar.photoUrl}
            displayName={avatar.displayName}
            size={size}
          />
        </View>
      ))}
      {remaining > 0 && (
        <View
          style={StyleSheet.flatten([
            styles.avatarGroupItem,
            { marginLeft: -size / 3, zIndex: 0 },
          ])}
        >
          <AvatarText label={`+${remaining}`} size={size} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarGroupItem: {
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 100,
  },
});
