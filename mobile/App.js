import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Android emulator -> development computer.
const API_URL = "http://10.0.2.2:4000/api";

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

async function requestApi(path, options = {}) {
  const url = `${API_URL}${path}`;
  console.log("MiniLedger request:", url);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error("MiniLedger fetch error:", error);
    throw new Error(
      `Cannot reach API: ${error.message || "Network request failed"}`,
    );
  }
}

export default function App() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);

  const [loans, setLoans] = useState([]);
  const [summary, setSummary] = useState({
    totalLent: 0,
    totalRepaid: 0,
    overdueAmount: 0,
  });

  const [friendName, setFriendName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showForm, setShowForm] = useState(false);

  const loadDashboard = useCallback(async () => {
    const queryPhone = encodeURIComponent(phone);
    const [loanData, summaryData] = await Promise.all([
      requestApi(`/loans?phone=${queryPhone}`),
      requestApi(`/summary?phone=${queryPhone}`),
    ]);

    setLoans(loanData);
    setSummary(summaryData);
  }, [phone]);

  useEffect(() => {
    if (loggedIn) {
      loadDashboard().catch((error) => Alert.alert("Error", error.message));
    }
  }, [loggedIn, loadDashboard]);

  async function sendOtp() {
    if (!/^\+?[0-9]{10,15}$/.test(phone.trim())) {
      Alert.alert("Invalid phone", "Enter a valid phone number.");
      return;
    }

    setLoading(true);
    try {
      await requestApi("/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim() }),
      });

      setPhone(phone.trim());
      setOtpSent(true);
      Alert.alert(
        "OTP generated",
        "Check the backend terminal for your demo OTP.",
      );
    } catch (error) {
      Alert.alert("Login error", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    try {
      await requestApi("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, otp: otp.trim() }),
      });

      setLoggedIn(true);
    } catch (error) {
      Alert.alert("Verification failed", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function addLoan() {
    const cleanName = friendName.trim();
    const numericAmount = Number(amount);

    if (!cleanName || cleanName.length > 100) {
      Alert.alert(
        "Invalid name",
        "Enter a friend's name (up to 100 characters).",
      );
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert("Invalid amount", "Amount must be greater than zero.");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD, for example 2026-11-15.");
      return;
    }

    const parsedDate = new Date(`${dueDate}T00:00:00Z`);
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== dueDate
    ) {
      Alert.alert("Invalid date", "Enter a real calendar date.");
      return;
    }

    setLoading(true);
    try {
      await requestApi("/loans", {
        method: "POST",
        body: JSON.stringify({
          phone,
          friendName: cleanName,
          amount: numericAmount,
          dueDate,
        }),
      });

      setFriendName("");
      setAmount("");
      setDueDate("");
      setShowForm(false);
      await loadDashboard();
      Alert.alert("Success", "Loan entry added.");
    } catch (error) {
      Alert.alert("Could not add loan", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function markRepaid(id) {
    setLoading(true);
    try {
      await requestApi(`/loans/${id}/repay`, {
        method: "PATCH",
        body: JSON.stringify({ phone }),
      });
      await loadDashboard();
    } catch (error) {
      Alert.alert("Update failed", error.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setLoggedIn(false);
    setOtp("");
    setOtpSent(false);
    setLoans([]);
    setSummary({ totalLent: 0, totalRepaid: 0, overdueAmount: 0 });
  }

  if (!loggedIn) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F7FB" />
        <KeyboardAvoidingView
          style={styles.center}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.loginCard}>
            <Text style={styles.logo}>MiniLedger</Text>
            <Text style={styles.subtitle}>
              Keep track of money lent to friends.
            </Text>

            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              placeholder="9876543210"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              editable={!otpSent}
            />

            {otpSent && (
              <>
                <Text style={styles.label}>One-time password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 6-digit OTP"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                />
              </>
            )}

            <TouchableOpacity
              style={styles.primaryButton}
              disabled={loading}
              onPress={otpSent ? verifyOtp : sendOtp}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {otpSent ? "Verify OTP" : "Send OTP"}
                </Text>
              )}
            </TouchableOpacity>

            {otpSent && (
              <TouchableOpacity
                onPress={() => {
                  setOtpSent(false);
                  setOtp("");
                }}
              >
                <Text style={styles.link}>Change phone number</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.demoNote}>
              Demo login: OTP is printed in your backend terminal.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FB" />

      <FlatList
        data={loans}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text style={styles.logo}>MiniLedger</Text>
                <Text style={styles.subtitle}>Your lending dashboard</Text>
              </View>
              <TouchableOpacity onPress={logout}>
                <Text style={styles.link}>Log out</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Total lent</Text>
              <Text style={styles.totalAmount}>{money(summary.totalLent)}</Text>

              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Repaid</Text>
                  <Text style={styles.repaidAmount}>
                    {money(summary.totalRepaid)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Overdue</Text>
                  <Text style={styles.overdueAmount}>
                    {money(summary.overdueAmount)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your loans</Text>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => setShowForm(!showForm)}
              >
                <Text style={styles.primaryButtonText}>
                  {showForm ? "Cancel" : "+ Add loan"}
                </Text>
              </TouchableOpacity>
            </View>

            {showForm && (
              <View style={styles.formCard}>
                <Text style={styles.label}>Friend's name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Rahul"
                  value={friendName}
                  onChangeText={setFriendName}
                  maxLength={100}
                />

                <Text style={styles.label}>Amount (₹)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 1500"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />

                <Text style={styles.label}>Due date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2026-11-15"
                  value={dueDate}
                  onChangeText={setDueDate}
                  maxLength={10}
                />

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={addLoan}
                  disabled={loading}
                >
                  <Text style={styles.primaryButtonText}>Save loan</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.listHint}>
              {loans.length} {loans.length === 1 ? "entry" : "entries"}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No loans yet</Text>
            <Text style={styles.subtitle}>
              Add your first loan to start tracking repayments.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const overdue =
            !item.repaid &&
            item.dueDate < new Date().toISOString().slice(0, 10);

          return (
            <View style={[styles.loanCard, overdue && styles.overdueCard]}>
              <View style={styles.loanTopRow}>
                <View style={styles.loanDetails}>
                  <Text style={styles.friendName}>{item.friendName}</Text>
                  <Text style={styles.loanDate}>Due {item.dueDate}</Text>
                </View>
                <Text style={styles.loanAmount}>{money(item.amount)}</Text>
              </View>

              <View style={styles.loanBottomRow}>
                <Text
                  style={[
                    styles.status,
                    item.repaid
                      ? styles.statusRepaid
                      : overdue
                        ? styles.statusOverdue
                        : styles.statusPending,
                  ]}
                >
                  {item.repaid ? "REPAID" : overdue ? "OVERDUE" : "PENDING"}
                </Text>

                {!item.repaid && (
                  <TouchableOpacity onPress={() => markRepaid(item.id)}>
                    <Text style={styles.link}>Mark repaid ✓</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
        ListFooterComponent={<View style={{ height: 30 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7FB" },
  center: { flex: 1, justifyContent: "center", padding: 22 },
  loginCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    elevation: 3,
  },
  logo: { fontSize: 28, fontWeight: "800", color: "#263A78" },
  subtitle: { fontSize: 14, color: "#737B8C", marginTop: 5 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#39445B",
    marginTop: 18,
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE1EA",
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 15,
    color: "#20283A",
  },
  primaryButton: {
    backgroundColor: "#344BA0",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 18,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  link: { color: "#344BA0", fontSize: 13, fontWeight: "700" },
  demoNote: {
    color: "#858B99",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 20,
    textAlign: "center",
  },
  listContent: { padding: 18, paddingBottom: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: "#263A78",
    padding: 20,
    borderRadius: 18,
    marginBottom: 25,
  },
  summaryTitle: { color: "#D8E1FF", fontSize: 14 },
  totalAmount: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
    marginTop: 5,
  },
  summaryRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#51629A",
    marginTop: 18,
    paddingTop: 16,
  },
  summaryItem: { flex: 1 },
  summaryLabel: { color: "#D8E1FF", fontSize: 12, marginBottom: 6 },
  repaidAmount: { color: "#8BE0BB", fontSize: 16, fontWeight: "700" },
  overdueAmount: { color: "#FFB1B1", fontSize: 16, fontWeight: "700" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: "#222C42" },
  smallButton: {
    backgroundColor: "#344BA0",
    borderRadius: 9,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    elevation: 1,
  },
  listHint: { color: "#858B99", fontSize: 12, marginBottom: 10 },
  emptyCard: {
    padding: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#30394C",
    marginBottom: 5,
  },
  loanCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E7EAF1",
  },
  overdueCard: {
    borderColor: "#E87575",
    backgroundColor: "#FFF5F4",
  },
  loanTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  loanDetails: { flex: 1, marginRight: 8 },
  friendName: { fontSize: 16, fontWeight: "700", color: "#263047" },
  loanDate: { fontSize: 12, color: "#81889A", marginTop: 5 },
  loanAmount: { fontSize: 16, fontWeight: "800", color: "#263A78" },
  loanBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
  },
  status: {
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    overflow: "hidden",
  },
  statusRepaid: { backgroundColor: "#DDF7EA", color: "#19734B" },
  statusOverdue: { backgroundColor: "#FFE0DE", color: "#B42318" },
  statusPending: { backgroundColor: "#E6EBFF", color: "#344BA0" },
});
