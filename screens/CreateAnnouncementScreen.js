import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';

const CreateAnnouncementScreen = ({ navigation, route }) => {
    const { userInfo, userRole } = useContext(AuthContext);
    const existingAnnouncement = route.params?.announcement;
    const isEditMode = !!existingAnnouncement;

    const [title, setTitle] = useState(existingAnnouncement ? existingAnnouncement.title : '');
    const [message, setMessage] = useState(existingAnnouncement ? existingAnnouncement.message : '');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!title.trim() || !message.trim()) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setSubmitting(true);
        try {
            if (isEditMode) {
                await client.put(`/announcements/${existingAnnouncement._id}`, {
                    title,
                    message
                });
                Alert.alert('Success', 'Announcement updated!');
            } else {
                await client.post('/announcements/create', {
                    title,
                    message,
                    authorName: userInfo.name,
                    authorRole: userRole
                });
                Alert.alert('Success', 'Announcement posted!');
            }
            navigation.goBack();
        } catch (error) {
            Alert.alert('Error', 'Failed to post announcement');
            console.log(error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Title</Text>
            <TextInput
                style={styles.input}
                placeholder="e.g. Exam Schedule Update"
                value={title}
                onChangeText={setTitle}
            />

            <Text style={styles.label}>Message</Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Type your announcement here..."
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
            />

            <TouchableOpacity
                style={styles.button}
                onPress={handleSubmit}
                disabled={submitting}
            >
                {submitting ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.btnText}>{isEditMode ? 'Update Announcement' : 'Post Announcement'}</Text>
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 20 },
    label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 15 },
    input: {
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#eee'
    },
    textArea: { height: 120 },
    button: {
        backgroundColor: '#4834d4',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 30
    },
    btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});

export default CreateAnnouncementScreen;
