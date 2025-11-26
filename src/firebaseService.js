import { db } from './firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

// --- Expenses ---

// Fetch all expenses and convert to the app's dictionary format: { "YYYY-MM-DD": [ ... ] }
export const fetchExpenses = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "expenses"));
        const expensesMap = {};

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const expense = { ...data, id: doc.id };
            const dateKey = expense.date; 

            if (!expensesMap[dateKey]) {
                expensesMap[dateKey] = [];
            }
            expensesMap[dateKey].push(expense);
        });

        return expensesMap;
    } catch (error) {
        console.error("Error fetching expenses from Firebase:", error);
        return {};
    }
};

export const saveExpense = async (expense) => {
    try {
        const expenseRef = doc(db, "expenses", expense.id);
        await setDoc(expenseRef, expense);
    } catch (error) {
        console.error("Error saving expense to Firebase:", error);
        throw error;
    }
};

export const deleteExpense = async (expenseId) => {
    try {
        await deleteDoc(doc(db, "expenses", expenseId));
    } catch (error) {
        console.error("Error deleting expense from Firebase:", error);
        throw error;
    }
};

export const saveAllExpenses = async (expensesMap) => {
    const batchPromises = [];
    Object.values(expensesMap).forEach(dayExpenses => {
        dayExpenses.forEach(exp => {
            batchPromises.push(saveExpense(exp));
        });
    });
    await Promise.all(batchPromises);
};

// --- Financial Profile ---

export const fetchFinancialProfile = async () => {
    try {
        const docRef = doc(db, "settings", "financialProfile");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching profile from Firebase:", error);
        return null;
    }
};

export const saveFinancialProfile = async (profile) => {
    try {
        await setDoc(doc(db, "settings", "financialProfile"), profile);
    } catch (error) {
        console.error("Error saving profile to Firebase:", error);
        throw error;
    }
};
