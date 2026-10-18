import { useState } from "react";
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Image } from "expo-image";
import { getAuctionImageSource } from "@/lib/auction-utils";

type Props = {
  images: string[];
  category: "electronics" | "home";
  positionLabel: (current: number, total: number) => string;
  badge?: string;
};

export function AuctionGallery({ images, category, positionLabel, badge }: Props) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const total = Math.max(images.length, 1);
  const activeIndex = Math.min(index, total - 1);

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!width) return;
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={onScrollEnd}
          scrollEventThrottle={16}
        >
          {images.map((key, position) => (
            <Image
              key={`${key}-${position}`}
              source={getAuctionImageSource(key, category)}
              contentFit="cover"
              style={{ width, height: "100%" }}
              accessibilityLabel={positionLabel(position + 1, total)}
            />
          ))}
        </ScrollView>
      ) : null}
      {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
      {total > 1 ? (
        <>
          <View style={styles.counter}><Text style={styles.counterText}>{activeIndex + 1}/{total}</Text></View>
          <View style={styles.dots}>
            {images.map((key, position) => <View key={`dot-${key}-${position}`} style={[styles.dot, position === activeIndex && styles.activeDot]} />)}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 300, overflow: "hidden", borderRadius: 23, backgroundColor: "#E8E5DE", position: "relative" },
  badge: { position: "absolute", top: 12, left: 12, backgroundColor: "rgba(255,255,255,0.93)", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99 },
  badgeText: { color: "#0D7C72", fontSize: 11, fontWeight: "800" },
  counter: { position: "absolute", top: 12, right: 12, backgroundColor: "rgba(23,43,42,0.78)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  counterText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", writingDirection: "ltr" },
  dots: { position: "absolute", bottom: 12, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.6)" },
  activeDot: { width: 20, backgroundColor: "#FFFFFF" },
});
