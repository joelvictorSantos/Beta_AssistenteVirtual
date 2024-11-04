import { Alert, Image, Text, View, StyleSheet, StatusBar, TouchableOpacity } from "react-native"; 
import React, { useCallback, useEffect, useRef, useState } from "react";
import { scale, verticalScale } from "react-native-size-matters";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import AntDesign from "@expo/vector-icons/AntDesign";
import LottieView from "lottie-react-native";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import OpenAI from "openai";
import axios from "axios";

import Regenerate from "@/assets/svgs/regenerate";
import Reload from "@/assets/svgs/reload";

// Inicialização do OpenAI
const openai = new OpenAI({
  apiKey: "" 
  //Na plataforma do OpenAi deverá solicitar uma chave que deve ser colocada aqui para conexão com API
});

export default function HomeScreen() {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording>();
  const [AIResponse, setAIResponse] = useState(false);
  const [AISpeaking, setAISpeaking] = useState(false);
  const lottieRef = useRef<LottieView>(null);

  const getMicrophonePermission = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Permissão", "Por favor, conceda permissão para acessar o microfone");
        return false;
      }
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  };

  const recordingOptions: any = {
    android: {
      extension: '.wav',
      outputFormat: Audio.AndroidOutputFormat.MPEG_4, // Ajuste para WAV
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 44100,
      numberOfChannels: 1, // Mudado para mono
      bitRate: 128000,
    },
    ios: {
      extension: '.wav',
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 44100,
      numberOfChannels: 1, // Mudado para mono
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
  };

  const startRecording = async () => {
    try {
      const hasPermission = await getMicrophonePermission();
      if (!hasPermission) return;
  
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
  
      setIsRecording(true);
      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      setRecording(recording);
    } catch (error) {
      console.error("Erro ao iniciar a gravação:", error);
      Alert.alert("Erro", "Falha ao iniciar a gravação");
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      setLoading(true);
      await recording?.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      const uri = recording?.getURI();

      // send audio to whisper API for transcription
      const transcript = await sendAudioToWhisper(uri!);

      setText(transcript);

      // send the transcript to gpt-4 API for response
      const gptResposta = await sendToGPT(transcript);
      
      setText(gptResposta);
      setAIResponse(true);
      setLoading(false);

      await speakText(gptResposta);
    } catch (error) {
      console.log("Falha para parar a gravação", error);
      Alert.alert("Erro", "Falha para parar a gravação");
    }
  };

  const sendAudioToWhisper = async (uri: string) => {
    try {
         const formData: any = new FormData();
         formData.append("file", {
           uri,
           type: "audio/wav", // Ajuste para audio/wav
           name: "recording.wav", // Nome do arquivo
         });
         formData.append("model", "whisper-1"); // Especifica o modelo a ser usado
   
         const response = await axios.post(
           "https://api.openai.com/v1/audio/transcriptions",
           formData,
           {
             headers: {
               Authorization: `Bearer ${openai.apiKey}`, // Use a chave da API
               "Content-Type": "multipart/form-data",
             },
           }
         );
   
         return response.data.text;
       } catch (error) {
         console.error("Erro ao enviar áudio para Whisper:", error);
         if (axios.isAxiosError(error)) {
           Alert.alert("Erro ao enviar áudio", error.response?.data?.error?.message || "Erro desconhecido ao enviar áudio");
         } else {
           Alert.alert("Erro desconhecido", "Ocorreu um erro ao enviar o áudio para o Whisper.");
         }
         return ""; // Retorna uma string vazia em caso de erro
       }
     };

  const getLastSentence = (text: String) => {
      const sentences = text.split(/(?<=[.!?])\s+/); // Divide o texto em frases
      return sentences[sentences.length - 1]; // Retorna a última frase
  };
  const sendToGPT = async (text: string) => {
  try {
    const response = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "Você é a Beta, uma assistente de IA que responde de forma clara e direta. Quando as perguntas forem curtas, responda rapidamente e sem enrolação. Sempre que possível, forneça respostas objetivas e úteis, priorizando a clareza. Você deve responder em português brasileiro, independentemente do idioma de entrada. Sua função é ajudar com perguntas e tarefas de maneira eficaz, aprendendo com cada interação para melhorar continuamente sua capacidade de atender às necessidades dos usuários.",
        },
        {
          role: "user",
          content: text,
        },
      ],
    }, {
      headers: {
        Authorization: `Bearer ${openai.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    // Obtenha a resposta completa
    const fullResponse = response.data.choices[0].message.content;

    // Pega apenas a última frase
    const lastSentence = getLastSentence(fullResponse);

    return lastSentence;
  } catch (error) {
    console.error("Erro ao enviar para GPT-4:", error);
    if (axios.isAxiosError(error)) {
      Alert.alert("Erro ao enviar para GPT-4", error.response?.data?.error?.message || "Erro desconhecido ao enviar para GPT-4");
    } else {
      Alert.alert("Erro desconhecido", "Ocorreu um erro ao enviar a mensagem para o GPT-4.");
    }
    return ""; // Retorna uma string vazia em caso de erro
   }
};

  const speakText = async (text: string) => {
    setAISpeaking(true); 
    const options = {
      voice: "pt-BR",
      language: "pt-BR",
      pitch: 1.0, // Ajustado para um valor mais natural
      rate: 1.1,  // Reduzido para uma fala mais clara
      onDone: () => {
        setAISpeaking(false); 
      },
    };
    Speech.speak(text, options);
  };

  useEffect(() => {
    if (AISpeaking) {
      lottieRef.current?.play();
    } else {
      lottieRef.current?.reset();
    }
  }, [AISpeaking]);

  return (
    <LinearGradient
      colors={["#001C39", "#000000"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
        <StatusBar barStyle={"light-content"} />

         {/* back shadows */}
      <Image
        source={require("@/assets/main/blur.png")}
        style={{
          position: "absolute",
          right: scale(-35),
          top: 0,
          width: scale(240),
        }}
      />
      <Image
        source={require("@/assets/main/blur2.png")}
        style={{
          position: "absolute",
          left: scale(-25),
          bottom: verticalScale(70),
          width: scale(210),
        }}
      />

      {/* Back arrow */}

      {AIResponse && (
        <TouchableOpacity
          style={{
            position: "absolute",
            top: verticalScale(50),
            left: scale(20),
          }}
          onPress={() => {
            setIsRecording(false);
            setAIResponse(false);
            setText("");
          }}
        >
          <AntDesign name="arrowleft" size={scale(20)} color="#fff" />
        </TouchableOpacity>
      )}

      <View style={{marginTop: verticalScale(-40)}}>
        { loading ? (
            <TouchableOpacity>
              <LottieView
                source={require("@/assets/animations/loading.json")}
                autoPlay
                loop
                speed={1.3}
                style={{ width: scale(270), height: scale(270) }}
              />
            </TouchableOpacity>
          ) : (
            <>
        {  !isRecording ? (
            <>
            {AIResponse ? (
              <View>
                <LottieView
                 ref={lottieRef}
                 source={require("@/assets/animations/ai-speaking.json")}
                 autoPlay={false}
                 loop={false}
                 style={{ width: scale(250), height: scale(250) }}
                />
              </View>
              ) : (
            <TouchableOpacity
        style={{
           width: scale(110),
           height: scale(110),
           backgroundColor: "#fff",
           flexDirection: "row",
           alignItems: "center",
           justifyContent: "center",
           borderRadius: scale(100),
        }}
        onPress={startRecording}
        >
            <FontAwesome name="microphone" size={scale(50)} color="#000"/>
        </TouchableOpacity>
        )}
            </>
          ) : (
            <TouchableOpacity
        onPress={stopRecording}
        >
          <LottieView
          source={require("@/assets/animations/animation.json")}
          autoPlay
          loop
          speed={1.3}
          style={{ width: scale(225), height: scale(225) }}
          />   
        </TouchableOpacity>
          )
        }
            </>
          )
        }
        </View>
        
        <View
        style={{
            alignItems: "center",
            width: scale(350),
            position: "absolute",
            bottom: verticalScale(90),
        }}
        >
        <Text
        style={{
            color: "#fff",
            fontSize: scale(22),
            width: scale(269),
            bottom: verticalScale(40),
            textAlign: "center",
            lineHeight: 25,
        }}
        >
           {loading ? "Carregando..." : text || "Pressione o Microfone"}
        </Text>
        </View>
        {AIResponse && (
        <View 
        style={{
          position: "absolute",
          bottom: verticalScale(40),
          left: 0,
          paddingHorizontal: scale(30),
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          width: scale(360),
        }}
        >
          <TouchableOpacity onPress={() => sendToGPT(text)}>
            <Regenerate />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => speakText(text)}>
            <Reload />
          </TouchableOpacity>
        </View>
     )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#131313",

  },
});