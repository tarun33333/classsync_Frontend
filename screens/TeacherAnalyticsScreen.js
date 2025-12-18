import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, ActivityIndicator, Platform, FlatList, Dimensions } from 'react-native';
import client from '../api/client';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { PieChart } from 'react-native-chart-kit';

const { StorageAccessFramework } = FileSystem;
const screenWidth = Dimensions.get('window').width;

const TeacherAnalyticsScreen = () => {
    // Selection State
    const [teacherClasses, setTeacherClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Date State
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    // Report State
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const res = await client.get('/routines/teacher/classes');
            setTeacherClasses(res.data);
        } catch (error) {
            console.log('Error fetching classes');
        }
    };

    const generateReport = async () => {
        if (!selectedClass) {
            Alert.alert('Error', 'Please select a class');
            return;
        }

        setLoading(true);
        setReportData(null);
        setStats(null);

        try {
            const payload = {
                dept: selectedClass.dept,
                semester: selectedClass.semester,
                subject: selectedClass.subject,
                section: selectedClass.section || 'A', // Default to A if not present
                startDate,
                endDate
            };

            const res = await client.post('/attendance/report/generate', payload);
            setReportData(res.data);
            calculateStats(res.data.report);
        } catch (error) {
            Alert.alert('Error', 'Failed to generate report');
            console.log(error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (data) => {
        if (!data || data.length === 0) {
            setStats({
                present: 0,
                absent: 0,
                avgValidation: 0
            });
            return;
        }

        // Calculate aggregate counts
        let totalPresent = 0;
        let totalClassesExpected = 0; // sum of total classes * students

        data.forEach(student => {
            totalPresent += student.present;
            totalClassesExpected += student.total;
        });

        const totalAbsent = totalClassesExpected - totalPresent;
        const avgPercentage = totalClassesExpected > 0 ? ((totalPresent / totalClassesExpected) * 100).toFixed(1) : 0;

        setStats({
            present: totalPresent,
            absent: totalAbsent,
            avgValidation: avgPercentage
        });
    };

    const downloadPdf = async () => {
        if (!reportData) return;

        const html = `
            <html>
            <head>
                <style>
                    body { font-family: Helvetica; padding: 20px; }
                    h1 { color: #4834d4; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background-color: #f2f2f2; color: #333; }
                    .low-attendance { color: red; font-weight: bold; }
                </style>
            </head>
            <body>
                <h1>Attendance Analytics</h1>
                <p><strong>Subject:</strong> ${selectedClass.subject}</p>
                <p><strong>Class:</strong> ${selectedClass.dept} - Sem ${selectedClass.semester}</p>
                <p><strong>Date Range:</strong> ${new Date(reportData.range.start).toLocaleDateString()} to ${new Date(reportData.range.end).toLocaleDateString()}</p>
                <p><strong>Total Classes Held:</strong> ${reportData.totalClasses}</p>
                <p><strong>Average Class Attendance:</strong> ${stats ? stats.avgValidation : 0}%</p>
                
                <table>
                    <thead>
                        <tr>
                            <th>Roll No</th>
                            <th>Name</th>
                            <th>Present</th>
                            <th>Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.report.map(item => `
                            <tr>
                                <td>${item.rollNumber || '-'}</td>
                                <td>${item.name}</td>
                                <td>${item.present}/${item.total}</td>
                                <td class="${item.percentage < 75 ? 'low-attendance' : ''}">${item.percentage}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        try {
            const { uri } = await Print.printToFileAsync({ html });

            if (Platform.OS === 'android' && StorageAccessFramework) {
                // Try using SAF
                try {
                    const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
                    if (permissions.granted) {
                        const fileName = `Analytics_${selectedClass.subject}_${new Date().getTime()}.pdf`;
                        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                        const createdUri = await StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, 'application/pdf');
                        await FileSystem.writeAsStringAsync(createdUri, base64, { encoding: FileSystem.EncodingType.Base64 });
                        Alert.alert('Success', 'PDF saved to your device!');
                        return;
                    }
                } catch (e) {
                    console.log('SAF Error', e);
                    // Fallthrough to sharing
                }
            }

            // Fallback
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

        } catch (error) {
            Alert.alert('Error', 'Could not generate or share PDF.');
            console.log(error);
        }
    };

    const RenderDateBtn = ({ date, setShow }) => (
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShow(true)}>
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
        </TouchableOpacity>
    );

    const chartConfig = {
        backgroundGradientFrom: "#ffffff",
        backgroundGradientTo: "#ffffff",
        color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
        strokeWidth: 2,
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.controls}>
                <Text style={styles.label}>Class:</Text>
                <TouchableOpacity style={styles.selector} onPress={() => setModalVisible(true)}>
                    <Text style={styles.selectorText}>
                        {selectedClass
                            ? `${selectedClass.dept} - Sem ${selectedClass.semester} - ${selectedClass.subject}`
                            : 'Select a Class'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>

                <Text style={styles.label}>Date Range:</Text>
                <View style={styles.dateRow}>
                    <RenderDateBtn date={startDate} setShow={setShowStartPicker} />
                    <Text style={{ marginHorizontal: 10 }}>to</Text>
                    <RenderDateBtn date={endDate} setShow={setShowEndPicker} />
                </View>

                {showStartPicker && (
                    <DateTimePicker
                        value={startDate}
                        mode="date"
                        display="default"
                        onChange={(event, selected) => {
                            setShowStartPicker(Platform.OS === 'ios');
                            if (selected) setStartDate(selected);
                        }}
                    />
                )}

                {showEndPicker && (
                    <DateTimePicker
                        value={endDate}
                        mode="date"
                        display="default"
                        onChange={(event, selected) => {
                            setShowEndPicker(Platform.OS === 'ios');
                            if (selected) setEndDate(selected);
                        }}
                    />
                )}

                <TouchableOpacity style={styles.generateBtn} onPress={generateReport} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Generate Analytics</Text>}
                </TouchableOpacity>
            </View>

            {/* Analytics Dashboard */}
            {reportData && stats && (
                <View style={styles.dashboard}>
                    {reportData.report.length === 0 ? (
                        <Text style={{ textAlign: 'center', marginVertical: 20, color: '#666' }}>No attendance records found for this period.</Text>
                    ) : (
                        <>
                            <Text style={styles.sectionTitle}>Overview</Text>

                            {/* Summary Cards */}
                            <View style={styles.statsRow}>
                                <View style={[styles.statCard, { backgroundColor: '#e3f2fd' }]}>
                                    <Text style={styles.statLabel}>Avg Attendance</Text>
                                    <Text style={[styles.statValue, { color: '#1976d2' }]}>{stats.avgValidation}%</Text>
                                </View>
                                <View style={[styles.statCard, { backgroundColor: '#e8f5e9' }]}>
                                    <Text style={styles.statLabel}>Total Classes</Text>
                                    <Text style={[styles.statValue, { color: '#2e7d32' }]}>{reportData.totalClasses}</Text>
                                </View>
                            </View>

                            {/* Chart */}
                            <ScrollView horizontal={true} contentContainerStyle={{ alignItems: 'center', width: '100%' }}>
                                <PieChart
                                    data={[
                                        { name: "Present", population: stats.present, color: "#4caf50", legendFontColor: "#7F7F7F", legendFontSize: 14 },
                                        { name: "Absent", population: stats.absent, color: "#f44336", legendFontColor: "#7F7F7F", legendFontSize: 14 }
                                    ]}
                                    width={screenWidth - 40}
                                    height={200}
                                    chartConfig={chartConfig}
                                    accessor={"population"}
                                    backgroundColor={"transparent"}
                                    paddingLeft={"15"}
                                    absolute
                                />
                            </ScrollView>

                            <View style={styles.resultHeader}>
                                <Text style={styles.sectionTitle}>Student Details</Text>
                                <TouchableOpacity style={styles.downloadIconBtn} onPress={downloadPdf}>
                                    <Ionicons name="download-outline" size={24} color="#4834d4" />
                                    <Text style={styles.downloadText}>PDF</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Student List */}
                            {reportData.report.map((item, index) => (
                                <View key={item.studentId} style={styles.row}>
                                    <View style={{ flex: 2 }}>
                                        <Text style={styles.name}>{index + 1}. {item.name}</Text>
                                        <Text style={styles.roll}>{item.rollNumber}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.present}>{item.present}/{item.total}</Text>
                                        <Text style={[styles.percentage, { color: item.percentage < 75 ? 'red' : 'green' }]}>
                                            {item.percentage}%
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </>
                    )}
                </View>
            )}

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalView}>
                    <Text style={styles.modalTitle}>Select Class</Text>
                    <FlatList
                        data={teacherClasses}
                        keyExtractor={(item, index) => `${item.subject}-${index}`}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.modalItem}
                                onPress={() => {
                                    setSelectedClass(item);
                                    setModalVisible(false);
                                }}
                            >
                                <Text style={styles.modalItemText}>{item.dept} - Sem {item.semester} - {item.subject}</Text>
                            </TouchableOpacity>
                        )}
                    />
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
                        <Text style={styles.closeBtnText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa', padding: 15 },
    controls: { backgroundColor: '#fff', padding: 15, borderRadius: 12, elevation: 2, marginBottom: 15 },
    label: { fontSize: 14, color: '#666', marginBottom: 5, fontWeight: 'bold' },
    selector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f0f0', padding: 12, borderRadius: 8, marginBottom: 15 },
    selectorText: { fontSize: 16 },
    dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8, justifyContent: 'center' },
    dateText: { marginLeft: 5, fontWeight: '600' },
    generateBtn: { backgroundColor: '#4834d4', padding: 15, borderRadius: 10, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    dashboard: { backgroundColor: '#fff', borderRadius: 12, padding: 15, elevation: 2, marginBottom: 30 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    statCard: { flex: 1, padding: 15, borderRadius: 10, marginHorizontal: 5, alignItems: 'center' },
    statLabel: { fontSize: 12, color: '#666', marginBottom: 5 },
    statValue: { fontSize: 20, fontWeight: 'bold' },

    resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 },
    downloadIconBtn: { flexDirection: 'row', alignItems: 'center' },
    downloadText: { marginLeft: 5, color: '#4834d4', fontWeight: 'bold' },

    row: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', alignItems: 'center', justifyContent: 'space-between' },
    name: { fontWeight: '600', fontSize: 15, color: '#333' },
    roll: { fontSize: 12, color: '#666' },
    present: { fontSize: 14, color: '#444', textAlign: 'right' },
    percentage: { fontWeight: 'bold', fontSize: 15, textAlign: 'right' },

    modalView: { flex: 1, marginTop: 50, backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, elevation: 5 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
    modalItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
    modalItemText: { fontSize: 16 },
    closeBtn: { marginTop: 20, backgroundColor: '#eee', padding: 15, alignItems: 'center', borderRadius: 10 },
    closeBtnText: { fontWeight: 'bold' }
});

export default TeacherAnalyticsScreen;
