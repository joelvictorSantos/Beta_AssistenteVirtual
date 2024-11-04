import React, { useRef, useState } from 'react';
import 
{ Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'; 
import { LinearGradient } from 'expo-linear-gradient';
import { scale, verticalScale } from "react-native-size-matters";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from "expo-router";
import { onBoardingData } from '@/configs/constans';


export default function OnboardingScreen() {

  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(
      contentOffsetX / event.nativeEvent.layoutMeasurement.width
    );
    setActiveIndex(currentIndex);
  };

  const identificadorSkip = async () => { 

    const proximaPagina = activeIndex + 1;

    if(proximaPagina < onBoardingData.length){
      scrollViewRef.current?.scrollTo({
      x: Dimensions.get('window').width * proximaPagina,
      animated: true,
      });
      setActiveIndex(proximaPagina); 
    }else {
      await AsyncStorage.setItem('onboarding', 'true');
      router.push('/(routes)/home');
    }
  }
  return (
    <LinearGradient
    colors={[ '#001C39', '#000000']}
    start = {{ x: 0, y: 0}}
    end = {{ x: 1, y: 1}}
    style = {styles.container}
    >
      <StatusBar barStyle="light-content" translucent={true} />
      <Pressable style={styles.skipContainer} onPress={identificadorSkip}>
        <Text style={styles.skipText}>Próximo</Text>
      </Pressable>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        ref={scrollViewRef}
      >
        {onBoardingData.map((item: onBoardingDataType, index: number) => (
          <View key={index} style={styles.slide}>
            {item.image}
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.paginationContainer}>
        {onBoardingData.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                opacity: activeIndex === index ? 1 : 0.3,
              },
            ]}
          />
        ))}
      </View>
    </LinearGradient>
  );
}

const styles =  StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  slide: {
    width: Dimensions.get("window").width,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: scale(23),
    textAlign: "center",
    fontWeight: "500",
    flexShrink: 1,
    letterSpacing: 1,
    marginBottom: verticalScale(5), 
  },
  subtitle: {
    width: scale(290),
    marginHorizontal: "auto",
    color: "#9A9999",
    fontSize: scale(15),
    textAlign: "center",
    fontWeight: "400",
    paddingTop: verticalScale(10),
    flexShrink: 1,
    letterSpacing: 1,
  },
  paginationContainer: {
    position: "absolute",
    bottom: verticalScale(70),
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: scale(8),
  },
  dot: {
    width: scale(8),
    height: scale(8),
    borderRadius: 100,
    backgroundColor: "#fff",
    marginHorizontal: scale(2),
  },
  skipContainer: {
    position: "absolute",
    top: verticalScale(47),
    right: scale(30),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
    zIndex: 100,
  },
  skipText: {
    color: "#fff",
    fontSize: scale(17),
    fontWeight: "400",
  },
});

