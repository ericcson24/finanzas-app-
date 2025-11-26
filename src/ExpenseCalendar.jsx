import React, { useState, useEffect, useMemo } from 'react';
import { fetchExpenses, saveExpense, deleteExpense, fetchFinancialProfile, saveFinancialProfile, saveAllExpenses } from './firebaseService'; // Import Firebase services
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import SmartInsights from './SmartInsights';

import * as XLSX from 'xlsx';

// Funciones utilitarias para manejo de fechas
const formatYYYYMMDD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const CATEGORIES = {
    expense: ['Comidas', 'Planes', 'Regalos', 'Suscripciones', 'Caprichos', 'Otros'],
    income: ['Nómina', 'Regalo', 'Venta', 'Otros']
};

const BudgetOverview = ({ budgets, expenses, currentDate, onCategoryClick, onEditBudget, isCustomBudget }) => {
    const categories = ['Comidas', 'Planes', 'Regalos', 'Suscripciones', 'Caprichos', 'Otros'];
    
    // Calcular gastos del mes actual por categoría
    const currentMonthExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === currentDate.getMonth() && 
               expenseDate.getFullYear() === currentDate.getFullYear();
    });

    const spendingByCategory = currentMonthExpenses.reduce((acc, expense) => {
        const cat = expense.category || 'Otros';
        acc[cat] = (acc[cat] || 0) + expense.amount;
        return acc;
    }, {});

    return (
        <div className="bg-black p-6 rounded-2xl border border-white/10 shadow-xl mb-8">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>📊</span> Estado del Presupuesto {isCustomBudget && <span className="text-xs bg-blue-900 text-blue-200 px-2 py-0.5 rounded border border-blue-700">Mes Personalizado</span>}
                </h3>
                <button 
                    onClick={onEditBudget}
                    className="text-xs bg-white/10 hover:bg-white/20 text-gray-300 px-3 py-1 rounded-lg transition border border-white/5"
                >
                    ✏️ Ajustar Límites
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(cat => {
                    const budget = budgets[cat] || 0;
                    const spent = spendingByCategory[cat] || 0;
                    const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                    const isOverBudget = spent > budget && budget > 0;

                    return (
                        <div 
                            key={cat} 
                            onClick={() => onCategoryClick(cat)}
                            className="bg-neutral-900 p-4 rounded-xl border border-white/10 cursor-pointer hover:bg-neutral-800 transition-all duration-300 group"
                        >
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-medium text-gray-200 group-hover:text-white transition-colors">{cat}</span>
                                <span className={`text-sm font-bold ${isOverBudget ? 'text-red-300' : 'text-green-300'}`}>
                                    {spent.toFixed(2)}€ / {budget}€
                                </span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                                <div 
                                    className={`h-2.5 rounded-full transition-all duration-1000 ease-out ${
                                        isOverBudget ? 'bg-red-300' : 
                                        percentage > 80 ? 'bg-white' : 'bg-green-300'
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            </div>
                            <div className="text-xs text-gray-400 mt-2 text-right font-mono">
                                {budget > 0 ? `${percentage.toFixed(1)}%` : 'Sin presupuesto'}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};



const MonthNavigator = ({ currentDate, navigateMonth }) => (
    <div className="flex items-center justify-center gap-6 mb-8 bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/5 w-full max-w-md mx-auto">
        <button 
            onClick={() => navigateMonth(-1)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition"
        >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        <h2 className="text-2xl font-bold text-white capitalize min-w-[200px] text-center">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button 
            onClick={() => navigateMonth(1)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition"
        >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
        </button>
    </div>
);

const TransactionHistory = ({ expenses, onEditExpense }) => {
    const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="bg-black p-6 rounded-xl shadow-lg border border-white/10">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span>📜</span> Historial de Movimientos
            </h3>
            <div className="space-y-3">
                {sortedExpenses.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay movimientos registrados.</p>
                ) : (
                    sortedExpenses.map(expense => (
                        <div 
                            key={expense.id}
                            onClick={() => onEditExpense(expense)}
                            className="bg-neutral-900 p-4 rounded-xl border border-white/5 hover:border-white/20 hover:bg-neutral-800 transition-all cursor-pointer group flex justify-between items-center"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full ${expense.type === 'income' ? 'bg-neutral-800 text-green-300' : 'bg-neutral-800 text-red-300'}`}>
                                    {expense.type === 'income' ? '💰' : '💸'}
                                </div>
                                <div>
                                    <h4 className="font-medium text-white group-hover:text-gray-300 transition-colors">
                                        {expense.description || expense.category}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-gray-400 bg-black px-2 py-0.5 rounded-full border border-white/10">
                                            {new Date(expense.date).toLocaleDateString()}
                                        </span>
                                        <span className="text-xs text-gray-400 bg-black px-2 py-0.5 rounded-full border border-white/10">
                                            {expense.category}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <span className={`font-bold text-lg ${expense.type === 'income' ? 'text-green-300' : 'text-red-300'}`}>
                                {expense.type === 'income' ? '+' : '-'}{expense.amount.toFixed(2)}€
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// Componente principal de la aplicación
const App = () => {
    // --- Estado de la Aplicación ---
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expenses, setExpenses] = useState({}); 
    const [financialProfile, setFinancialProfile] = useState({
        monthlySalary: 0,
        payday: 1,
        savingsTarget: 0,
        currency: 'EUR',
        initialBase: 0,
        budgets: {
            'Comidas': 0,
            'Planes': 0,
            'Regalos': 0,
            'Suscripciones': 0,
            'Caprichos': 0,
            'Otros': 0
        },
        monthlyBudgets: {},
        accounts: { bbva: 0, revolut: 0, cash: 0 },
        fundBalances: { investments: 200, travel: 55, flexible: 120 },
        pockets: { expenses: 0, subscriptions: 0, travel: 55, flexible: 20, investments: 25 },
        lastDistributionMonth: ''
    });

    // --- Auth & Data Loading ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    const loadedExpenses = await fetchExpenses(currentUser.uid);
                    setExpenses(loadedExpenses);

                    const loadedProfile = await fetchFinancialProfile(currentUser.uid);
                    if (loadedProfile) {
                        setFinancialProfile(prev => ({
                            ...prev,
                            ...loadedProfile
                        }));
                    }
                } catch (error) {
                    console.error("Error loading data:", error);
                }
            } else {
                setExpenses({});
                setFinancialProfile({
                    monthlySalary: 0,
                    payday: 1,
                    savingsTarget: 0,
                    currency: 'EUR',
                    initialBase: 0,
                    budgets: { 'Comidas': 0, 'Planes': 0, 'Regalos': 0, 'Suscripciones': 0, 'Caprichos': 0, 'Otros': 0 },
                    accounts: { bbva: 0, revolut: 0, cash: 0 },
                    fundBalances: { investments: 0, travel: 0, flexible: 0 }
                });
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Login failed:", error);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [configInitialMonth, setConfigInitialMonth] = useState('default');
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    
    // Estado para el modal de añadir fondos
    const [isFundModalOpen, setIsFundModalOpen] = useState(false);
    const [selectedFundKey, setSelectedFundKey] = useState(null);
    const [selectedFundName, setSelectedFundName] = useState('');
    const [selectedFundBalance, setSelectedFundBalance] = useState(0);

    const [currentDate, setCurrentDate] = useState(new Date()); 
    const [selectedDay, setSelectedDay] = useState(null); 
    
    // Estados del formulario
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expenseType, setExpenseType] = useState('expense'); // 'expense' o 'income'
    const [expenseCategory, setExpenseCategory] = useState('Otros');
    const [editingExpenseId, setEditingExpenseId] = useState(null);

    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'calendar', 'history'

    const handleManageFunds = (amount, isTransfer, mode, newTotal) => {
        if (!selectedFundKey) return;
        
        let finalBalance = 0;
        let transactionAmount = 0;
        let transactionType = 'expense';
        let description = '';
        const currentBalance = Number(financialProfile.fundBalances?.[selectedFundKey] || 0);

        if (mode === 'add') {
            const numAmount = parseFloat(amount);
            if (isNaN(numAmount) || numAmount === 0) return;
            finalBalance = currentBalance + numAmount;
            
            // Si es positivo, es gasto (sale de cuenta principal a hucha). Si es negativo, es ingreso (vuelve de hucha).
            transactionAmount = Math.abs(numAmount);
            if (numAmount > 0) {
                description = `Transferencia a ${selectedFundName}`;
                transactionType = 'transfer'; // Cambiado de 'expense' a 'transfer' para no afectar gráficas de gastos
            } else {
                description = `Retirada de ${selectedFundName}`;
                transactionType = 'income';
            }
        } else if (mode === 'set') {
            const numTotal = parseFloat(newTotal);
            if (isNaN(numTotal)) return;
            finalBalance = numTotal;
            
            const diff = numTotal - currentBalance;
            if (diff === 0) {
                setIsFundModalOpen(false);
                return;
            }

            transactionAmount = Math.abs(diff);
            if (diff > 0) {
                description = `Ajuste: ${selectedFundName} (Aumento)`;
                transactionType = 'transfer'; // Asumimos que sale de la cuenta principal
            } else {
                description = `Ajuste: ${selectedFundName} (Disminución)`;
                transactionType = 'income';
            }
        }

        // 1. Actualizar el saldo de la cartera en el perfil
        const newProfile = { ...financialProfile };
        if (!newProfile.fundBalances) newProfile.fundBalances = { investments: 0, travel: 0, flexible: 0 };
        
        newProfile.fundBalances[selectedFundKey] = finalBalance;
        
        setFinancialProfile(newProfile);
        saveFinancialProfile(newProfile, user.uid);

        // 2. Si es transferencia/ajuste contable, crear el movimiento
        if (isTransfer && transactionAmount > 0) {
            const expenseData = {
                id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(),
                date: formatYYYYMMDD(new Date()),
                amount: transactionAmount,
                description: description,
                type: transactionType,
                category: 'Otros', 
                createdAt: new Date().toISOString(), 
                userId: user.uid
            };
            
            const dateKey = formatYYYYMMDD(new Date());
            const newExpenses = { ...expenses };
            if (!newExpenses[dateKey]) newExpenses[dateKey] = [];
            newExpenses[dateKey].push(expenseData);
            
            setExpenses(newExpenses);
            saveExpense(expenseData);
        }

        setIsFundModalOpen(false);
        alert(`✅ Saldo de ${selectedFundName} actualizado a ${finalBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}.`);
    };

    const openFundModal = (key, name, currentBalance) => {
        setSelectedFundKey(key);
        setSelectedFundName(name);
        setSelectedFundBalance(currentBalance || 0);
        setIsFundModalOpen(true);
    };

    // --- Inicialización desde Firebase ---
    // Removed old useEffect since logic is now in Auth listener


    // --- Lógica del Calendario y Cálculos ---

    // Función que genera el calendario para el mes actual
    const getCalendarDays = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        
        const firstDayOfMonth = new Date(year, month, 1);
        
        let startingDay = firstDayOfMonth.getDay(); 
        startingDay = startingDay === 0 ? 6 : startingDay - 1;
        
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        
        const prevMonthDays = [];
        const prevMonthDate = new Date(year, month, 0);
        const daysInPrevMonth = prevMonthDate.getDate();
        for (let i = startingDay - 1; i >= 0; i--) {
            prevMonthDays.push({ 
                date: new Date(year, month - 1, daysInPrevMonth - i), 
                isCurrentMonth: false 
            });
        }

        const currentMonthDays = [];
        for (let i = 1; i <= lastDayOfMonth; i++) {
            currentMonthDays.push({ 
                date: new Date(year, month, i), 
                isCurrentMonth: true 
            });
        }

        const allDays = [...prevMonthDays, ...currentMonthDays];
        
        const remainingCells = 42 - allDays.length; 
        const nextMonthDays = [];
        for (let i = 1; i <= remainingCells; i++) {
            nextMonthDays.push({ 
                date: new Date(year, month + 1, i), 
                isCurrentMonth: false 
            });
        }

        return [...allDays, ...nextMonthDays].map(day => ({
            ...day,
            dateKey: formatYYYYMMDD(day.date)
        }));
    };

    const getWeeks = (days) => {
        const weeks = [];
        for (let i = 0; i < 42; i += 7) {
            weeks.push(days.slice(i, i + 7));
        }
        return weeks;
    };
    
    const calendarDays = useMemo(() => getCalendarDays(currentDate), [currentDate]);
    const calendarWeeks = useMemo(() => getWeeks(calendarDays), [calendarDays]);

    const calculateWeekTotal = (weekDays) => {
        let total = 0;
        weekDays.forEach(day => {
            const dailyExpenses = expenses[day.dateKey] || [];
            dailyExpenses.forEach(exp => {
                if (exp.type !== 'income') {
                    total += exp.amount;
                }
            });
        });
        return total;
    };

    const monthlyStats = useMemo(() => {
        const yearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        let income = 0;
        let expense = 0;
        
        Object.entries(expenses).forEach(([dateKey, dailyExpenses]) => {
            if (dateKey.startsWith(yearMonth)) {
                dailyExpenses.forEach(exp => {
                    if (exp.type === 'income') {
                        income += exp.amount;
                    } else if (exp.type === 'expense') {
                        // Solo sumamos como gasto si es tipo 'expense'. 'transfer' se ignora en esta suma.
                        expense += exp.amount;
                    }
                });
            }
        });
        return { income, expense, balance: income - expense };
    }, [expenses, currentDate]);

    const weeklyTotals = useMemo(() => {
        return calendarWeeks.map(week => calculateWeekTotal(week));
    }, [expenses, calendarWeeks]);

    // Aplanar todos los gastos para facilitar filtrado y reportes
    const allExpensesArray = useMemo(() => {
        return expenses ? Object.values(expenses).flat() : [];
    }, [expenses]);

    // 1. Dinero Hoy (Real Time Balance): Saldo hasta el momento exacto actual
    const realTimeBalance = useMemo(() => {
        const now = new Date();
        // Usamos el final del día de hoy para incluir transacciones de hoy, 
        // pero si el usuario quiere "estrictamente hasta ahora", podríamos filtrar por hora si la tuviéramos.
        // Como solo tenemos fecha, asumimos que "Hoy" incluye todo lo de hoy.
        const todayStr = formatYYYYMMDD(now);
        
        const totalBalance = allExpensesArray.reduce((acc, exp) => {
            const expDateStr = exp.date; // YYYY-MM-DD
            // Si la fecha es anterior o igual a hoy
            if (expDateStr <= todayStr) {
                if (exp.type === 'income') {
                    return acc + Number(exp.amount);
                } else {
                    // Restamos expenses y transfers
                    return acc - Number(exp.amount);
                }
            }
            return acc;
        }, 0);
        return (Number(financialProfile.initialBase) || 0) + totalBalance;
    }, [allExpensesArray, financialProfile.initialBase]);

    // 2. Colchón Acumulado (Total Wealth): Carteras + Dinero Hoy (Real Time)
    const totalGlobalSavings = useMemo(() => {
        const walletsTotal = (financialProfile.fundBalances?.investments || 0) + 
                             (financialProfile.fundBalances?.travel || 0) + 
                             (financialProfile.fundBalances?.flexible || 0);

        return realTimeBalance + walletsTotal;
    }, [realTimeBalance, financialProfile]);

    // --- Proyecciones para meses futuros ---
    const monthsDiff = useMemo(() => {
        const today = new Date();
        return (currentDate.getFullYear() - today.getFullYear()) * 12 + (currentDate.getMonth() - today.getMonth());
    }, [currentDate]);

    const isFuture = monthsDiff > 0;

    const projectedFundBalances = useMemo(() => {
        if (!isFuture) return financialProfile.fundBalances;
        
        const { investments, travel, flexible } = financialProfile.pockets || {};
        // Sumatorio de aportaciones mensuales: Saldo Actual + (Aportación * Meses)
        return {
            investments: (financialProfile.fundBalances?.investments || 0) + (investments * monthsDiff),
            travel: (financialProfile.fundBalances?.travel || 0) + (travel * monthsDiff),
            flexible: (financialProfile.fundBalances?.flexible || 0) + (flexible * monthsDiff)
        };
    }, [financialProfile, isFuture, monthsDiff]);

    const displayMainBalance = useMemo(() => {
        if (!isFuture) return realTimeBalance;
        
        // Disponible Estimado = Disponible Anterior (Real) + (Salario - Aportaciones) * Meses
        // No restamos gastos aquí porque representa el "Techo de Gasto" o disponibilidad antes de vivir el mes.
        const { investments, travel, flexible } = financialProfile.pockets || {};
        const walletContributions = (Number(investments) || 0) + (Number(travel) || 0) + (Number(flexible) || 0);
        const monthlyDisposable = (Number(financialProfile.monthlySalary) || 0) - walletContributions;
        
        return realTimeBalance + (monthlyDisposable * monthsDiff);
    }, [isFuture, realTimeBalance, financialProfile, monthsDiff]);

    const displayColchon = useMemo(() => {
        if (!isFuture) return totalGlobalSavings;

        // Colchón = Colchón Pasado + Balance * Meses
        // Balance = Salario - Gastos Presupuestados (Las carteras se mueven dentro del colchón, no restan)
        const totalBudgetedExpenses = Object.values(financialProfile.budgets || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
        const monthlyBalance = (Number(financialProfile.monthlySalary) || 0) - totalBudgetedExpenses;

        return totalGlobalSavings + (monthlyBalance * monthsDiff);
    }, [isFuture, totalGlobalSavings, financialProfile, monthsDiff]);

    const colchonBreakdown = useMemo(() => {
        if (!isFuture) return null;
        
        const totalBudgetedExpenses = Object.values(financialProfile.budgets || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
        const monthlyBalance = (Number(financialProfile.monthlySalary) || 0) - totalBudgetedExpenses;
        
        // Previous Cushion (Month N-1)
        const prevMonths = Math.max(0, monthsDiff - 1);
        const prevColchon = totalGlobalSavings + (monthlyBalance * prevMonths);

        return `${prevColchon.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€ + ${monthlyBalance.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€`;
    }, [isFuture, totalGlobalSavings, financialProfile, monthsDiff]);



    // --- Funciones de Eventos y Manejo de Gastos ---

    const navigateMonth = (amount) => {
        setCurrentDate(prevDate => {
            const newDate = new Date(prevDate);
            newDate.setMonth(prevDate.getMonth() + amount);
            return newDate;
        });
    };

    const handleDayClick = (dateKey) => {
        setSelectedDay(dateKey);
        setExpenseAmount('');
        setExpenseDescription('');
        setExpenseType('expense');
        setExpenseCategory('Otros');
        setEditingExpenseId(null);
    };

    const handleAddExpense = () => {
        if (!selectedDay) return;
        const amount = parseFloat(expenseAmount);
        if (isNaN(amount) || amount <= 0) return;

        const newExpenses = { ...expenses };

        if (editingExpenseId) {
            const dayExpenses = newExpenses[selectedDay] || [];
            const updatedDayExpenses = dayExpenses.map(exp => {
                if (exp.id === editingExpenseId) {
                    const updatedExp = {
                        ...exp,
                        amount,
                        description: expenseDescription || (expenseType === 'income' ? 'Ingreso' : 'Gasto'),
                        type: expenseType,
                        category: expenseCategory
                    };
                    saveExpense(updatedExp);
                    return updatedExp;
                }
                return exp;
            });
            newExpenses[selectedDay] = updatedDayExpenses;
            setEditingExpenseId(null);
        } else {
            const expenseData = {
                id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(),
                date: selectedDay,
                amount: amount,
                description: expenseDescription || (expenseType === 'income' ? 'Ingreso' : 'Gasto'),
                type: expenseType,
                category: expenseCategory,
                createdAt: new Date().toISOString(), 
                userId: user.uid
            };
            const dayExpenses = newExpenses[selectedDay] ? [...newExpenses[selectedDay]] : [];
            dayExpenses.push(expenseData);
            newExpenses[selectedDay] = dayExpenses;
            saveExpense(expenseData);
        }
        
        setExpenses(newExpenses);
        
        setExpenseAmount('');
        setExpenseDescription('');
    };

    const handleEditClick = (expense) => {
        setExpenseAmount(expense.amount.toString());
        setExpenseDescription(expense.description);
        setExpenseType(expense.type);
        setExpenseCategory(expense.category);
        setEditingExpenseId(expense.id);
    };

    const handleCancelEdit = () => {
        setExpenseAmount('');
        setExpenseDescription('');
        setEditingExpenseId(null);
        setExpenseType('expense');
        setExpenseCategory('Otros');
    };

    const handleDeleteExpense = (id) => {
        const newExpenses = { ...expenses };
        if (selectedDay && newExpenses[selectedDay]) {
            newExpenses[selectedDay] = newExpenses[selectedDay].filter(exp => exp.id !== id);
            if (newExpenses[selectedDay].length === 0) {
                delete newExpenses[selectedDay];
            }
            setExpenses(newExpenses);
            deleteExpense(id);
        }
    };

    const handleSaveProfile = (newProfile) => {
        setFinancialProfile(newProfile);
        saveFinancialProfile(newProfile, user.uid);
        setIsConfigOpen(false);
    };

    const handleExportData = () => {
        const dataToExport = {
            expenses: expenses,
            financialProfile: financialProfile
        };
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `finanzas_backup_${formatYYYYMMDD(new Date())}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportData = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (!user) {
                    alert('Debes iniciar sesión para importar datos.');
                    return;
                }

                // Función auxiliar para procesar gastos y asegurar userId e id
                const processExpenses = (expensesMap) => {
                    const processed = {};
                    Object.keys(expensesMap).forEach(dateKey => {
                        const dayExpenses = expensesMap[dateKey];
                        if (Array.isArray(dayExpenses)) {
                            processed[dateKey] = dayExpenses.map(exp => ({
                                ...exp,
                                id: exp.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString().slice(2)),
                                userId: user.uid
                            }));
                        }
                    });
                    return processed;
                };

                if (importedData.expenses) {
                    const processedExpenses = processExpenses(importedData.expenses);
                    setExpenses(processedExpenses);
                    saveAllExpenses(processedExpenses);
                    
                    if (importedData.financialProfile) {
                        setFinancialProfile(importedData.financialProfile);
                        saveFinancialProfile(importedData.financialProfile, user.uid);
                    }
                } else {
                    // Soporte para formato antiguo donde importedData es directamente el mapa de gastos
                    const processedExpenses = processExpenses(importedData);
                    setExpenses(processedExpenses);
                    saveAllExpenses(processedExpenses);
                }
                
                alert('Datos importados y guardados en Firebase correctamente.');
            } catch (error) {
                console.error("Error al importar:", error);
                alert('Error al importar el archivo. Asegúrate de que es un JSON válido.');
            }
        };
        reader.readAsText(file);
    };

    // --- Nuevas funciones para manejo de categorías ---

    const handleCategoryClick = (category) => {
        setSelectedCategory(category);
    };

    const handleCreateCheckpoint = (date, actualBalance, updatedAccounts) => {
        const targetDate = new Date(date);
        // Asegurar que comparamos hasta el final del día seleccionado
        const endOfTargetDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);
        const targetDateStr = formatYYYYMMDD(targetDate);

        const expensesUpToDate = allExpensesArray.filter(exp => exp.date <= targetDateStr);
        
        const calculatedBalance = (financialProfile.initialBase || 0) + expensesUpToDate.reduce((acc, exp) => {
            if (exp.type === 'income') {
                return acc + Number(exp.amount);
            } else {
                // Restamos expenses y transfers
                return acc - Number(exp.amount);
            }
        }, 0);

        const difference = actualBalance - calculatedBalance;

        // Actualizar también los saldos de las cuentas en el perfil si se proporcionaron
        if (updatedAccounts) {
            const newProfile = { ...financialProfile, accounts: updatedAccounts };
            setFinancialProfile(newProfile);
            saveFinancialProfile(newProfile, user.uid);
        }

        if (Math.abs(difference) < 0.01) {
            alert("✅ El balance calculado ya coincide con el real. Se han actualizado los saldos de las cuentas.");
            setIsCheckpointModalOpen(false);
            return;
        }

        const adjustmentType = difference > 0 ? 'income' : 'expense';
        const adjustmentAmount = Math.abs(difference);
        
        const adjustmentTransaction = {
            id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(),
            date: formatYYYYMMDD(targetDate),
            amount: adjustmentAmount,
            description: '🔄 Ajuste de Balance (Checkpoint)',
            type: adjustmentType,
            category: 'Otros',
            createdAt: new Date().toISOString(),
            userId: user.uid
        };

        const dateKey = formatYYYYMMDD(targetDate);
        const newExpenses = { ...expenses };
        if (!newExpenses[dateKey]) newExpenses[dateKey] = [];
        newExpenses[dateKey].push(adjustmentTransaction);
        
        setExpenses(newExpenses);
        saveExpense(adjustmentTransaction);
        setIsCheckpointModalOpen(false);
        alert(`✅ Balance ajustado correctamente.\nSe ha creado un movimiento de ${adjustmentType === 'income' ? 'ingreso' : 'gasto'} de ${adjustmentAmount.toFixed(2)}€.`);
    };

    const handleEditExpense = (expense) => {
        setSelectedDay(expense.date);
        handleEditClick(expense);
        setSelectedCategory(null);
    };

    const currentMonthCategoryExpenses = useMemo(() => {
        if (!selectedCategory) return [];
        return allExpensesArray.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expense.category === selectedCategory &&
                   expenseDate.getMonth() === currentDate.getMonth() && 
                   expenseDate.getFullYear() === currentDate.getFullYear();
        });
    }, [selectedCategory, allExpensesArray, currentDate]);

    const executeMonthlyDistribution = () => {
        const currentMonthStr = formatYYYYMMDD(new Date()).substring(0, 7); // YYYY-MM
        
        // 1. Get amounts from pockets
        const { investments, travel, flexible } = financialProfile.pockets || { investments: 0, travel: 0, flexible: 0 };
        
        // 2. Create transactions
        const newExpenses = { ...expenses };
        const todayStr = formatYYYYMMDD(new Date());
        
        const createTransfer = (amount, name) => ({
            id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString() + Math.random(),
            date: todayStr,
            amount: Number(amount),
            description: `Aportación Mensual: ${name}`,
            type: 'transfer',
            category: 'Otros',
            createdAt: new Date().toISOString(),
            userId: user.uid
        });

        const transactions = [];
        if (investments > 0) transactions.push(createTransfer(investments, 'Inversiones'));
        if (travel > 0) transactions.push(createTransfer(travel, 'Viajes'));
        if (flexible > 0) transactions.push(createTransfer(flexible, 'Flexible'));

        if (transactions.length === 0) {
            alert("⚠️ No hay cantidades definidas en la distribución mensual (Configuración > Distribución Ideal).");
            return;
        }

        if (!newExpenses[todayStr]) newExpenses[todayStr] = [];
        newExpenses[todayStr].push(...transactions);

        // 3. Update balances
        const newFundBalances = { ...financialProfile.fundBalances };
        newFundBalances.investments = (newFundBalances.investments || 0) + Number(investments);
        newFundBalances.travel = (newFundBalances.travel || 0) + Number(travel);
        newFundBalances.flexible = (newFundBalances.flexible || 0) + Number(flexible);

        // 4. Save everything
        const newProfile = { 
            ...financialProfile, 
            fundBalances: newFundBalances,
            lastDistributionMonth: currentMonthStr
        };

        setExpenses(newExpenses);
        setFinancialProfile(newProfile);
        
        transactions.forEach(t => saveExpense(t));
        saveFinancialProfile(newProfile, user.uid);
        
        alert("✅ Distribución mensual ejecutada correctamente.");
    };

    const isDistributionPending = useMemo(() => {
        if (!financialProfile.payday) return false;
        const today = new Date();
        const currentMonthStr = formatYYYYMMDD(today).substring(0, 7);
        
        // If already done this month, return false
        if (financialProfile.lastDistributionMonth === currentMonthStr) return false;
        
        // If today >= payday, it's pending
        return today.getDate() >= financialProfile.payday;
    }, [financialProfile]);

    if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Cargando...</div>;
    if (!user) return <LoginScreen onLogin={handleLogin} />;

    return (
        <div className="min-h-screen bg-black text-white font-sans flex flex-col items-center p-4">
            <style jsx="true">{`
                /* Estilo de la barra de desplazamiento para el efecto visual */
                .glass-scroll::-webkit-scrollbar {
                    width: 8px;
                }
                .glass-scroll::-webkit-scrollbar-thumb {
                    background-color: rgba(255, 255, 255, 0.2);
                    border-radius: 10px;
                }
                .glass-scroll::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.1);
                }

                /* Custom Scrollbar para Smart Insights */
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.3);
                }
            `}</style>
            
            {/* Contenedor Principal con Efecto Frosted Glass */}
            <div className="w-full max-w-8xl p-6 rounded-3xl shadow-2xl border border-white/10 
                            backdrop-filter backdrop-blur-3xl bg-black transition duration-500">

                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-extrabold text-white">
                        Calendario Financiero
                    </h1>
                    <div className="flex gap-4 items-center">
                        <span className="text-sm text-gray-400 hidden md:inline">Hola, {user.displayName}</span>
                        <button 
                            onClick={() => { setConfigInitialMonth('default'); setIsConfigOpen(true); }}
                            className="p-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-gray-300 transition border border-white/10"
                            title="Configuración"
                        >
                            ⚙️
                        </button>
                        <button 
                            onClick={handleLogout}
                            className="p-2 bg-neutral-900 hover:bg-neutral-800 text-red-300 rounded-lg transition border border-white/10"
                            title="Cerrar Sesión"
                        >
                            🚪
                        </button>
                    </div>
                </div>

                {/* Navegación por Pestañas */}
                <div className="flex p-1 bg-neutral-900 rounded-xl mb-8 border border-white/10 backdrop-blur-sm">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`flex-1 py-3 rounded-lg font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                            activeTab === 'dashboard' 
                            ? 'bg-neutral-800 text-white border border-white/10 shadow-lg' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <span>📊</span> <span className="hidden sm:inline">Dashboard</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('calendar')}
                        className={`flex-1 py-3 rounded-lg font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                            activeTab === 'calendar' 
                            ? 'bg-neutral-800 text-white border border-white/10 shadow-lg' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <span>📅</span> <span className="hidden sm:inline">Calendario</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-3 rounded-lg font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                            activeTab === 'history' 
                            ? 'bg-neutral-800 text-white border border-white/10 shadow-lg' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <span>📜</span> <span className="hidden sm:inline">Movimientos</span>
                    </button>
                </div>

                {activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-fade-in">
                        <MonthNavigator 
                            currentDate={currentDate} 
                            navigateMonth={navigateMonth} 
                        />

                        <DashboardStats 
                            expenses={expenses} 
                            currentDate={currentDate}
                            financialProfile={financialProfile}
                            accumulatedCushion={displayMainBalance}
                            onOpenCheckpoint={() => setIsCheckpointModalOpen(true)}
                            isFuture={isFuture}
                        />

                        <WalletOverview 
                            fundBalances={projectedFundBalances} 
                            onManageFunds={openFundModal}
                            isDistributionPending={isDistributionPending}
                            onExecuteDistribution={executeMonthlyDistribution}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <SummaryCard 
                                title="Salario Base" 
                                value={monthlyStats.income} 
                                subtitle="Total Ingresado"
                                color="text-green-300"
                            />
                            <SummaryCard 
                                title="Gastos" 
                                value={monthlyStats.expense} 
                                subtitle="Total Gastado"
                                color="text-red-300"
                            />
                            <SummaryCard 
                                title="Balance" 
                                value={monthlyStats.balance} 
                                subtitle="Diferencia"
                                color={monthlyStats.balance >= 0 ? "text-blue-300" : "text-orange-300"}
                            />
                            <SummaryCard 
                                title={isFuture ? "Colchón Proyectado" : "Colchón Acumulado"} 
                                value={displayColchon} 
                                secondaryValue={isFuture ? colchonBreakdown : null}
                                subtitle={isFuture ? "Estimación Futura" : "Dinero Hoy + Carteras"}
                                color={displayColchon >= 0 ? "text-purple-300" : "text-red-300"}
                                onAdjust={() => setIsCheckpointModalOpen(true)}
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <AnalyticsView expenses={allExpensesArray} currentDate={currentDate} />
                            <BudgetOverview 
                                budgets={financialProfile.monthlyBudgets?.[`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`] || financialProfile.budgets}
                                isCustomBudget={!!financialProfile.monthlyBudgets?.[`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`]}
                                expenses={allExpensesArray}
                                currentDate={currentDate}
                                onCategoryClick={handleCategoryClick}
                                onEditBudget={() => {
                                    setConfigInitialMonth(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`);
                                    setIsConfigOpen(true);
                                }}
                            />
                        </div>

                        <SmartInsights 
                            expenses={allExpensesArray} 
                            currentDate={currentDate} 
                            financialProfile={financialProfile}
                            accumulatedCushion={realTimeBalance}
                        />
                    </div>
                )}

                {activeTab === 'calendar' && (
                    <div className="animate-fade-in">
                        <Calendar 
                            currentDate={currentDate}
                            navigateMonth={navigateMonth}
                            calendarWeeks={calendarWeeks}
                            handleDayClick={handleDayClick}
                            selectedDay={selectedDay}
                            weeklyTotals={weeklyTotals}
                            expenses={expenses}
                        />
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="animate-fade-in">
                        <TransactionHistory 
                            expenses={allExpensesArray} 
                            onEditExpense={handleEditExpense} 
                        />
                    </div>
                )}
                
                <p className="mt-8 text-xs text-center text-gray-400 break-all">
                    Datos sincronizados en la nube con Firebase
                </p>

            </div>

            <ExpenseModal 
                selectedDay={selectedDay}
                expenses={expenses}
                expenseAmount={expenseAmount}
                setExpenseAmount={setExpenseAmount}
                expenseDescription={expenseDescription}
                setExpenseDescription={setExpenseDescription}
                expenseType={expenseType}
                setExpenseType={setExpenseType}
                expenseCategory={expenseCategory}
                setExpenseCategory={setExpenseCategory}
                handleAddExpense={handleAddExpense}
                handleDeleteExpense={handleDeleteExpense}
                setSelectedDay={setSelectedDay}
                CATEGORIES={CATEGORIES}
                editingExpenseId={editingExpenseId}
                handleEditClick={handleEditClick}
                handleCancelEdit={handleCancelEdit}
            />

            {isConfigOpen && (
                <FinancialProfileModal 
                    profile={financialProfile} 
                    onSave={handleSaveProfile} 
                    onClose={() => setIsConfigOpen(false)} 
                    onImport={handleImportData}
                    onExport={handleExportData}
                    initialTargetMonth={configInitialMonth}
                />
            )}

            {selectedCategory && (
                <CategoryDetailModal
                    category={selectedCategory}
                    expenses={currentMonthCategoryExpenses}
                    onClose={() => setSelectedCategory(null)}
                    onEditExpense={handleEditExpense}
                />
            )}

            {isCheckpointModalOpen && (
                <CheckpointModal
                    onClose={() => setIsCheckpointModalOpen(false)}
                    onSave={handleCreateCheckpoint}
                    currentAccounts={financialProfile.accounts}
                />
            )}

            {isFundModalOpen && (
                <FundModal
                    fundName={selectedFundName}
                    currentBalance={selectedFundBalance}
                    onClose={() => setIsFundModalOpen(false)}
                    onSave={handleManageFunds}
                />
            )}
        </div>
    );
};

const FundModal = ({ fundName, currentBalance, onClose, onSave }) => {
    const [activeTab, setActiveTab] = useState('add'); // 'add' | 'set'
    const [amount, setAmount] = useState('');
    const [total, setTotal] = useState(currentBalance);
    const [isTransfer, setIsTransfer] = useState(true);

    const handleSubmit = () => {
        if (activeTab === 'add') {
            onSave(amount, isTransfer, 'add', null);
        } else {
            onSave(null, isTransfer, 'set', total);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-neutral-900 p-6 rounded-2xl border border-white/10 w-full max-w-sm shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-4">Gestionar {fundName}</h3>
                
                <div className="flex p-1 bg-black rounded-lg mb-6 border border-white/10">
                    <button
                        onClick={() => setActiveTab('add')}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition ${activeTab === 'add' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Ingresar / Retirar
                    </button>
                    <button
                        onClick={() => setActiveTab('set')}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition ${activeTab === 'set' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Definir Saldo
                    </button>
                </div>

                {activeTab === 'add' ? (
                    <div className="mb-4 animate-fade-in">
                        <label className="block text-xs text-gray-400 mb-1">Cantidad a mover (€)</label>
                        <p className="text-[10px] text-gray-500 mb-2">Usa números negativos para retirar dinero.</p>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full p-3 bg-black border border-white/20 rounded-lg text-white text-lg focus:border-blue-500"
                            placeholder="0.00"
                            autoFocus
                        />
                    </div>
                ) : (
                    <div className="mb-4 animate-fade-in">
                        <label className="block text-xs text-gray-400 mb-1">Nuevo Saldo Total (€)</label>
                        <p className="text-[10px] text-gray-500 mb-2">El saldo actual es {currentBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                        <input
                            type="number"
                            value={total}
                            onChange={(e) => setTotal(e.target.value)}
                            className="w-full p-3 bg-black border border-white/20 rounded-lg text-white text-lg focus:border-purple-500"
                            placeholder="0.00"
                            autoFocus
                        />
                    </div>
                )}

                <div className="mb-6 flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
                    <input
                        type="checkbox"
                        checked={isTransfer}
                        onChange={(e) => setIsTransfer(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded bg-black border-gray-600 text-blue-500 focus:ring-blue-500"
                    />
                    <div>
                        <span className="block text-sm text-gray-200 font-medium">Impactar cuenta principal</span>
                        <span className="block text-xs text-gray-500">
                            {activeTab === 'add' 
                                ? "Crear un movimiento de gasto/ingreso por esta cantidad." 
                                : "Crear un movimiento por la diferencia de saldo."}
                        </span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 p-3 bg-transparent hover:bg-white/5 text-gray-400 rounded-xl font-bold transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="flex-1 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition shadow-lg shadow-blue-900/20"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

const WalletOverview = ({ fundBalances, onManageFunds, isDistributionPending, onExecuteDistribution }) => {
    const balances = fundBalances || { investments: 0, travel: 0, flexible: 0 };
    
    return (
        <div className="mb-8">
            {isDistributionPending && (
                <div className="mb-4 p-4 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/30 rounded-xl flex justify-between items-center animate-pulse">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🔔</span>
                        <div>
                            <h4 className="font-bold text-white">Distribución Mensual Pendiente</h4>
                            <p className="text-xs text-blue-200">Es día de cobro. ¿Quieres repartir los fondos a tus carteras?</p>
                        </div>
                    </div>
                    <button 
                        onClick={onExecuteDistribution}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-lg shadow-lg transition transform hover:scale-105"
                    >
                        Ejecutar
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl border border-white/10 bg-gradient-to-br from-purple-900/20 to-black backdrop-blur-md relative overflow-hidden group">
                <div className="flex justify-between items-start mb-2 relative z-10">
                    <div>
                        <h4 className="text-gray-400 text-sm font-medium">Cartera de Inversiones</h4>
                        <p className="text-2xl font-bold text-purple-300 mt-1">
                            {Number(balances.investments || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </p>
                    </div>
                    <button 
                        onClick={() => onManageFunds('investments', 'Inversiones', balances.investments)}
                        className="p-2 bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 rounded-lg transition"
                        title="Gestionar fondos"
                    >
                        ⚙️
                    </button>
                </div>
                <p className="text-xs text-gray-500 relative z-10">Capital invertido acumulado</p>
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
            </div>

            <div className="p-5 rounded-2xl border border-white/10 bg-gradient-to-br from-blue-900/20 to-black backdrop-blur-md relative overflow-hidden group">
                <div className="flex justify-between items-start mb-2 relative z-10">
                    <div>
                        <h4 className="text-gray-400 text-sm font-medium">Hucha de Viajes</h4>
                        <p className="text-2xl font-bold text-blue-300 mt-1">
                            {Number(balances.travel || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </p>
                    </div>
                    <button 
                        onClick={() => onManageFunds('travel', 'Viajes', balances.travel)}
                        className="p-2 bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 rounded-lg transition"
                        title="Gestionar fondos"
                    >
                        ⚙️
                    </button>
                </div>
                <p className="text-xs text-gray-500 relative z-10">Fondo para aventuras</p>
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
            </div>

            <div className="p-5 rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-900/20 to-black backdrop-blur-md relative overflow-hidden group">
                <div className="flex justify-between items-start mb-2 relative z-10">
                    <div>
                        <h4 className="text-gray-400 text-sm font-medium">Cartera Flexible</h4>
                        <p className="text-2xl font-bold text-emerald-300 mt-1">
                            {Number(balances.flexible || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </p>
                    </div>
                    <button 
                        onClick={() => onManageFunds('flexible', 'Flexible', balances.flexible)}
                        className="p-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 rounded-lg transition"
                        title="Gestionar fondos"
                    >
                        ⚙️
                    </button>
                </div>
                <p className="text-xs text-gray-500 relative z-10">Dinero disponible para imprevistos</p>
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
            </div>
        </div>
        </div>
    );
};

const DashboardStats = ({ financialProfile, currentDate, expenses, accumulatedCushion, onOpenCheckpoint, isFuture }) => {
    const { monthlySalary, payday, savingsTarget, budgets, monthlyBudgets } = financialProfile;
    
    const today = new Date();
    let nextPaydayDate = new Date(today.getFullYear(), today.getMonth(), payday);
    if (today.getDate() > payday) {
        nextPaydayDate = new Date(today.getFullYear(), today.getMonth() + 1, payday);
    }
    const daysUntilPayday = Math.ceil((nextPaydayDate - today) / (1000 * 60 * 60 * 24));

    // Calcular balance efectivo (Proyección)
    const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    let totalIncome = 0;
    let totalExpense = 0;
    let salaryReceived = false;

    if (expenses) {
        Object.entries(expenses).forEach(([dateKey, dayExpenses]) => {
            if (dateKey.startsWith(currentMonthStr)) {
                dayExpenses.forEach(exp => {
                    if (exp.type === 'income') {
                        totalIncome += exp.amount;
                        if (exp.category === 'Nómina' || (monthlySalary > 0 && exp.amount >= monthlySalary * 0.9)) {
                            salaryReceived = true;
                        }
                    } else {
                        totalExpense += exp.amount;
                    }
                });
            }
        });
    }

    // Balance actual (Real hasta la fecha)
    const currentSavings = salaryReceived ? (totalIncome - totalExpense) : (totalIncome + monthlySalary - totalExpense);
    const savingsProgress = savingsTarget > 0 ? Math.min((currentSavings / savingsTarget) * 100, 100) : 0;

    // --- Cálculos para la cuadrícula ---
    
    // 1. Gastos Asignados (Presupuesto)
    const activeBudgets = monthlyBudgets?.[currentMonthStr] || budgets || {};
    const assignedExpenses = Object.values(activeBudgets).reduce((sum, val) => sum + (Number(val) || 0), 0);

    // 2. Ahorro Asignado (Teórico)
    const assignedSavings = (Number(monthlySalary) || 0) - assignedExpenses;

    // 3. Gastos Previstos (Proyección)
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const isCurrentMonth = currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
    const currentDay = today.getDate();
    
    let projectedExpenses = totalExpense;
    if (isCurrentMonth && currentDay > 0) {
            projectedExpenses = (totalExpense / currentDay) * daysInMonth;
    }

    // 4. Ahorro Previsto (Proyección a fin de mes)
    const projectedSavings = (Number(monthlySalary) || 0) - projectedExpenses;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-xl border border-white/10 bg-black backdrop-blur-md flex flex-col items-center justify-center">
                <span className="text-gray-400 text-sm mb-1 uppercase tracking-wider">Próximo Cobro</span>
                <div className="text-3xl font-bold text-blue-300">{daysUntilPayday} días</div>
                <span className="text-xs text-gray-500">Día {payday} de cada mes</span>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-black backdrop-blur-md flex flex-col justify-center relative overflow-hidden">
                <div className="flex justify-between items-center mb-2 z-10 relative">
                    <span className="text-gray-300 font-bold text-sm">Meta de Ahorro</span>
                    <span className="text-xs text-gray-400">{currentSavings.toLocaleString()} / {savingsTarget.toLocaleString()} €</span>
                </div>
                
                <div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden mb-3 z-10 relative">
                    <div 
                        className={`h-full transition-all duration-500 ${currentSavings >= savingsTarget ? 'bg-green-400' : 'bg-white'}`}
                        style={{ width: `${Math.max(0, savingsProgress)}%` }}
                    ></div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs z-10 relative">
                    <div className="bg-white/5 p-2 rounded border border-white/5">
                        <span className="block text-gray-500 mb-0.5">Gastos Asignados</span>
                        <span className="font-mono text-white">{assignedExpenses.toLocaleString()} €</span>
                    </div>
                    <div className="bg-white/5 p-2 rounded border border-white/5">
                        <span className="block text-gray-500 mb-0.5">Ahorro Asignado</span>
                        <span className={`font-mono ${assignedSavings >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                            {assignedSavings.toLocaleString()} €
                        </span>
                    </div>
                    <div className="bg-white/5 p-2 rounded border border-white/5">
                        <span className="block text-gray-500 mb-0.5">Gastos Previstos</span>
                        <span className="font-mono text-yellow-200">{projectedExpenses.toLocaleString(undefined, {maximumFractionDigits: 0})} €</span>
                    </div>
                    <div className="bg-white/5 p-2 rounded border border-white/5">
                        <span className="block text-gray-500 mb-0.5">Ahorro Previsto</span>
                        <span className={`font-mono ${projectedSavings >= 0 ? 'text-blue-300' : 'text-red-300'}`}>
                            {projectedSavings.toLocaleString(undefined, {maximumFractionDigits: 0})} €
                        </span>
                    </div>
                </div>
                
                {/* Background Glow */}
                <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-20 ${currentSavings >= savingsTarget ? 'bg-green-500' : 'bg-blue-500'}`}></div>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-black backdrop-blur-md flex flex-col items-center justify-center relative group">
                <span className="text-gray-400 text-sm mb-1 uppercase tracking-wider">{isFuture ? "Disponible Estimado" : "Dinero Hoy"}</span>
                <div className="text-3xl font-bold text-purple-300">
                    {accumulatedCushion.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </div>
                <span className="text-xs text-gray-500">{isFuture ? "Salario - Aportaciones" : "Saldo Acumulado Real"}</span>
                {!isFuture && (
                    <button 
                        onClick={onOpenCheckpoint}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white hover:bg-gray-200 rounded-lg text-black text-xs font-bold shadow-lg"
                        title="Ajustar Saldo Real (Checkpoint)"
                    >
                        🎯 Ajustar
                    </button>
                )}
            </div>
        </div>
    );
};

const FinancialProfileModal = ({ profile, onSave, onClose, onImport, onExport, initialTargetMonth = 'default' }) => {
    const [formData, setFormData] = useState({
        ...profile,
        accounts: profile.accounts || { bbva: 0, revolut: 0, cash: 0 },
        pockets: profile.pockets || { expenses: 0, subscriptions: 0, travel: 0, flexible: 0, investments: 0 },
        fundBalances: profile.fundBalances || { investments: 0, travel: 0, flexible: 0 },
        monthlyBudgets: profile.monthlyBudgets || {},
        budgets: profile.budgets || {
            'Comidas': 0,
            'Planes': 0,
            'Regalos': 0,
            'Suscripciones': 0,
            'Caprichos': 0,
            'Otros': 0
        }
    });

    const [targetMonth, setTargetMonth] = useState(initialTargetMonth); // 'default' or 'YYYY-MM'

    // Helper para obtener los presupuestos a mostrar (del mes seleccionado o el default)
    const getBudgetsForRender = () => {
        if (targetMonth === 'default') return formData.budgets || {};
        return formData.monthlyBudgets?.[targetMonth] || formData.budgets || {};
    };

    const currentBudgets = getBudgetsForRender();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleAccountChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            accounts: {
                ...prev.accounts,
                [name]: Number(value)
            }
        }));
    };

    const handlePocketChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            pockets: {
                ...prev.pockets,
                [name]: Number(value)
            }
        }));
    };

    const handleFundBalanceChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            fundBalances: {
                ...prev.fundBalances,
                [name]: Number(value)
            }
        }));
    };

    const handleBudgetChange = (e) => {
        const { name, value } = e.target;
        const numValue = Number(value);

        setFormData(prev => {
            if (targetMonth === 'default') {
                return {
                    ...prev,
                    budgets: { ...prev.budgets, [name]: numValue }
                };
            } else {
                const currentMonthBudgets = prev.monthlyBudgets?.[targetMonth] || prev.budgets || {};
                return {
                    ...prev,
                    monthlyBudgets: {
                        ...prev.monthlyBudgets,
                        [targetMonth]: {
                            ...currentMonthBudgets,
                            [name]: numValue
                        }
                    }
                };
            }
        });
    };

    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                // Buscar la fila del mes actual
                const today = new Date();
                const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                const currentMonthStr = `${monthNamesEn[today.getMonth()]} ${today.getFullYear()}`;
                
                // Encontrar la fila de encabezados (buscando "Mes" en las primeras filas)
                let headerRowIndex = -1;
                for(let i=0; i<Math.min(20, jsonData.length); i++) {
                    if (jsonData[i] && jsonData[i].some(cell => cell && cell.toString().trim() === 'Mes')) {
                        headerRowIndex = i;
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    alert(" No se encontró la columna 'Mes' en las primeras 20 filas del Excel.");
                    return;
                }

                const headerRow = jsonData[headerRowIndex];
                const monthColIndex = headerRow.findIndex(cell => cell && cell.toString().trim() === 'Mes');
                
                let targetRow = null;
                const foundMonths = [];

                // Buscar en las filas de datos
                for(let i = headerRowIndex + 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if(row && row[monthColIndex]) {
                        const cellVal = String(row[monthColIndex]).trim();
                        foundMonths.push(cellVal);
                        if (cellVal.toLowerCase() === currentMonthStr.toLowerCase()) {
                            targetRow = row;
                            break;
                        }
                    }
                }

                if (targetRow) {
                    const getVal = (header) => {
                        const idx = headerRow.findIndex(cell => cell && cell.toString().trim() === header);
                        if (idx === -1) return 0;
                        
                        let val = targetRow[idx];
                        if (val === undefined || val === null || val === '') return 0;
                        
                        // Si es un string con coma decimal (ej: "979,44"), reemplazar por punto
                        if (typeof val === 'string' && val.includes(',')) {
                            val = val.replace(',', '.');
                        }
                        
                        const num = Number(val);
                        return isNaN(num) ? 0 : num;
                    };

                    setFormData(prev => ({
                        ...prev,
                        monthlySalary: getVal('Ingreso (€)'),
                        savingsTarget: getVal('Ahorro (€)'),
                        initialBase: (getVal('Dinero Cartera Flexible') || 0) + (getVal('Dinero para viajes') || 0), // Suma aproximada inicial si viene del excel
                        budgets: {
                            ...prev.budgets,
                            'Comidas': getVal('Comidas'),
                            'Planes': getVal('Planes'),
                            'Regalos': getVal('Regalos'),
                            'Suscripciones': getVal('Suscripciones'),
                            'Caprichos': getVal('Caprichos'),
                            'Otros': getVal('Otros')
                        }
                    }));
                    alert(`✅ Datos cargados correctamente para ${currentMonthStr}.\n\nSe han actualizado:\n- Salario Mensual: ${getVal('Ingreso (€)')}€\n- Meta Ahorro: ${getVal('Ahorro (€)')}€\n- Presupuestos y Saldos`);
                } else {
                    alert(`⚠️ No se encontraron datos para "${currentMonthStr}".\n\nMeses encontrados en el Excel:\n${foundMonths.slice(0, 10).join('\n')}`);
                }

            } catch (error) {
                console.error("Error parsing Excel:", error);
                alert("❌ Error al leer el archivo Excel: " + error.message);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSubmit = () => {
        onSave({
            ...formData,
            monthlySalary: Number(formData.monthlySalary),
            payday: Number(formData.payday),
            savingsTarget: Number(formData.savingsTarget),
            initialBase: Number(formData.initialBase || 0),
            budgets: formData.budgets || {},
            monthlyBudgets: formData.monthlyBudgets || {},
            accounts: formData.accounts || { bbva: 0, revolut: 0, cash: 0 },
            pockets: formData.pockets || { expenses: 0, subscriptions: 0, travel: 0, flexible: 0, investments: 0 },
            fundBalances: formData.fundBalances || { investments: 0, travel: 0, flexible: 0 }
        });
    };

    // Generar opciones de meses (Mes actual + 11 meses siguientes)
    const monthOptions = useMemo(() => {
        const options = [{ value: 'default', label: 'Presupuesto Base (Por Defecto)' }];
        const today = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
        }
        return options;
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm">
            <div className="w-full max-w-5xl p-8 rounded-3xl border border-white/10 shadow-2xl bg-neutral-950 text-white my-8">
                <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                    <div>
                        <h3 className="text-3xl font-bold text-white">Configuración Financiera</h3>
                        <p className="text-gray-400 text-sm mt-1">Define tus cuentas, ingresos y distribución ideal.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Columna 1: Ingresos y Cuentas */}
                    <div className="space-y-6">
                        <h4 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                            <span>🏦</span> Cuentas e Ingresos
                        </h4>
                        
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Salario Mensual Neto</label>
                                <input
                                    type="number"
                                    name="monthlySalary"
                                    value={formData.monthlySalary}
                                    onChange={handleChange}
                                    className="w-full p-3 bg-black border border-white/20 rounded-lg focus:border-blue-500 text-white font-mono text-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Día de Cobro</label>
                                <input
                                    type="number"
                                    name="payday"
                                    min="1"
                                    max="31"
                                    value={formData.payday}
                                    onChange={handleChange}
                                    className="w-full p-3 bg-black border border-white/20 rounded-lg focus:border-blue-500 text-white"
                                />
                            </div>
                        </div>

                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4">
                            <h5 className="text-sm font-semibold text-gray-300">Configuración de Saldos</h5>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Saldo Inicial (Base)</label>
                                <p className="text-[10px] text-gray-500 mb-1">Dinero que tenías antes de empezar a usar la app.</p>
                                <input
                                    type="number"
                                    name="initialBase"
                                    value={formData.initialBase || 0}
                                    onChange={handleChange}
                                    className="w-full p-3 bg-black border border-white/20 rounded-lg focus:border-blue-500 text-white font-mono text-lg"
                                />
                            </div>

                            <div className="pt-2 border-t border-white/5">
                                <h5 className="text-xs font-semibold text-gray-400 mb-2">Saldos de Cuentas (Referencia)</h5>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">BBVA</label>
                                    <input
                                        type="number"
                                        name="bbva"
                                        value={formData.accounts?.bbva || 0}
                                        onChange={handleAccountChange}
                                        className="w-full p-2 bg-black border border-white/10 rounded text-white text-right"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Revolut</label>
                                    <input
                                        type="number"
                                        name="revolut"
                                        value={formData.accounts?.revolut || 0}
                                        onChange={handleAccountChange}
                                        className="w-full p-2 bg-black border border-white/10 rounded text-white text-right"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Columna 2: Sobres Digitales (Pockets) */}
                    <div className="space-y-6">
                        <h4 className="text-xl font-bold text-purple-400 flex items-center gap-2">
                            <span>📨</span> Distribución Mensual Ideal
                        </h4>
                        <p className="text-xs text-gray-500">Define cuánto quieres destinar a cada "bolsillo" mensualmente.</p>

                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Cartera de Gastos (Diarios)</label>
                                <input
                                    type="number"
                                    name="expenses"
                                                                       value={formData.pockets?.expenses || 0}
                                    onChange={handlePocketChange}
                                    className="w-full p-2 bg-black border border-white/10 rounded text-white text-right focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Suscripciones (Fijos)</label>
                                <input
                                    type="number"
                                    name="subscriptions"
                                    value={formData.pockets?.subscriptions || 0}
                                    onChange={handlePocketChange}
                                    className="w-full p-2 bg-black border border-white/10 rounded text-white text-right focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Viajes (Aportación)</label>
                                <input
                                    type="number"
                                    name="travel"
                                    value={formData.pockets?.travel || 0}
                                    onChange={handlePocketChange}
                                    className="w-full p-2 bg-black border border-white/10 rounded text-white text-right focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Cartera Flexible (Aportación)</label>
                                <input
                                    type="number"
                                    name="flexible"
                                    value={formData.pockets?.flexible || 0}
                                    onChange={handlePocketChange}
                                    className="w-full p-2 bg-black border border-white/10 rounded text-white text-right focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Inversiones (Aportación)</label>
                                <input
                                    type="number"
                                    name="investments"
                                    value={formData.pockets?.investments || 0}
                                    onChange={handlePocketChange}
                                    className="w-full p-2 bg-black border border-white/10 rounded text-white text-right focus:border-purple-500"
                                />
                            </div>
                        </div>

                        <h4 className="text-xl font-bold text-emerald-400 flex items-center gap-2 mt-6">
                            <span>💰</span> Saldos Acumulados
                        </h4>
                        <p className="text-xs text-gray-500">¿Cuánto dinero tienes YA en estas carteras?</p>
                        
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Cartera de Inversiones (Total)</label>
                                <input
                                    type="number"
                                    name="investments"
                                    value={formData.fundBalances?.investments || 0}
                                    onChange={handleFundBalanceChange}
                                    className="w-full p-2 bg-black border border-white/10 rounded text-white text-right focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Hucha de Viajes (Total)</label>
                                <input
                                    type="number"
                                    name="travel"
                                    value={formData.fundBalances?.travel || 0}
                                    onChange={handleFundBalanceChange}
                                    className="w-full p-2 bg-black border border-white/10 rounded text-white text-right focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Cartera Flexible (Total)</label>
                                <input
                                    type="number"
                                    name="flexible"
                                    value={formData.fundBalances?.flexible || 0}
                                    onChange={handleFundBalanceChange}
                                    className="w-full p-2 bg-black border border-white/10 rounded text-white text-right focus:border-emerald-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Columna 3: Presupuesto Detallado */}
                    <div className="space-y-6">
                        <h4 className="text-xl font-bold text-green-400 flex items-center gap-2">
                            <span>📊</span> Límites por Categoría
                        </h4>
                        
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
                            <div className="mb-4">
                                <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Configurar para:</label>
                                <select 
                                    value={targetMonth}
                                    onChange={(e) => setTargetMonth(e.target.value)}
                                    className="w-full p-2 bg-black border border-white/20 rounded text-white text-sm focus:border-green-500"
                                >
                                    {monthOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                {targetMonth !== 'default' && (
                                    <p className="text-xs text-green-400 mt-1">Editando presupuesto específico para este mes.</p>
                                )}
                            </div>

                            {['Comidas', 'Planes', 'Regalos', 'Suscripciones', 'Caprichos', 'Otros'].map(cat => (
                                <div key={cat} className="flex items-center justify-between">
                                    <label className="text-sm text-gray-300">{cat}</label>
                                    <input
                                        type="number"
                                        name={cat}
                                        value={currentBudgets[cat] || 0}
                                        onChange={handleBudgetChange}
                                        className="w-24 p-2 bg-black border border-white/10 rounded text-white text-right text-sm focus:border-green-500"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="pt-4 border-t border-white/10">
                            <h4 className="text-lg font-bold text-white mb-4">Gestión de Datos</h4>
                            <div className="flex gap-2">
                                <button 
                                    onClick={onExport}
                                    className="flex-1 p-2 bg-gray-800 hover:bg-gray-700 rounded text-xs font-bold border border-gray-600"
                                >
                                    📤 Exportar JSON
                                </button>
                                <label className="flex-1 p-2 bg-gray-800 hover:bg-gray-700 rounded text-xs font-bold border border-gray-600 cursor-pointer text-center">
                                    📥 Importar JSON
                                    <input type="file" accept=".json" onChange={onImport} className="hidden" />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 mt-8 pt-6 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-transparent hover:bg-white/5 rounded-xl font-bold text-gray-400 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="flex-1 px-6 py-3 bg-white text-black hover:bg-gray-200 rounded-xl font-bold transition shadow-lg shadow-white/10"
                    >
                        Guardar Configuración
                    </button>
                </div>
            </div>
        </div>
    );
};

const ExpenseSummary = ({ dateKey, expenses }) => {
    const dailyExpenses = expenses[dateKey] || [];
    const hasAdjustment = dailyExpenses.some(exp => exp.description && exp.description.includes('Checkpoint'));

    const total = dailyExpenses.reduce((sum, exp) => {
        return exp.type === 'income' ? sum + exp.amount : sum - exp.amount;
    }, 0);

    return (
        <div className="flex flex-col items-center">
            {dailyExpenses.length > 0 && (
                <span className={`text-xs font-bold ${hasAdjustment ? 'text-yellow-400' : (total >= 0 ? 'text-green-400' : 'text-red-400')}`}>
                    {total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </span>
            )}
        </div>
    );
};

const Calendar = ({ 
    currentDate, 
    navigateMonth, 
    calendarWeeks, 
    handleDayClick, 
    selectedDay, 
    weeklyTotals, 
    expenses 
}) => (
    <div className="w-full">
        <div className="flex justify-between items-center p-4">
            <button 
                onClick={() => navigateMonth(-1)}
                className="p-2 text-white hover:text-gray-300 transition"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>
            <h2 className="text-3xl font-extrabold text-white">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button 
                onClick={() => navigateMonth(1)}
                className="p-2 text-white hover:text-gray-300 transition"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
        </div>
        
        <div className="grid grid-cols-8 text-center font-semibold text-gray-400 text-sm">
            {daysOfWeek.map(day => (
                <div key={day} className="p-3 border-b border-white/10">{day}</div>
            ))}
            <div className="p-3 border-b border-white/10 bg-white/5 text-white font-bold">TOTAL SEMANA</div>
        </div>

        {calendarWeeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-8 gap-px p-1">
                {week.map((day, dayIndex) => {
                    const isToday = formatYYYYMMDD(day.date) === formatYYYYMMDD(new Date());
                    const isSelected = day.dateKey === selectedDay;

                    return (
                        <div
                            key={dayIndex}
                            onClick={() => handleDayClick(day.dateKey)}
                            className={`
                                p-2 h-20 flex flex-col items-center justify-start cursor-pointer transition
                                backdrop-filter backdrop-blur-md bg-neutral-900 border border-white/5
                                hover:bg-neutral-800 rounded-lg
                                ${day.isCurrentMonth ? 'text-white' : 'text-gray-600 opacity-60'}
                                ${isToday ? 'border-2 border-white ring-2 ring-white/20' : ''}
                                ${isSelected ? 'bg-neutral-800 border-white' : ''}
                            `}
                        >
                            <span className="text-lg font-medium">{day.date.getDate()}</span>
                            <ExpenseSummary dateKey={day.dateKey} expenses={expenses} />
                        </div>
                    );
                })}

                <div className="flex items-center justify-center p-2 rounded-lg 
                                backdrop-filter backdrop-blur-md bg-neutral-900 border border-white/10">
                    <span className="text-xl font-extrabold text-white">
                        {weeklyTotals[weekIndex].toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </span>
                </div>
            </div>
        ))}
    </div>
);

const ExpenseModal = ({
    selectedDay,
    expenses,
    expenseAmount,
    setExpenseAmount,
    expenseDescription,
    setExpenseDescription,
    expenseType,
    setExpenseType,
    expenseCategory,
    setExpenseCategory,
    handleAddExpense,
    handleDeleteExpense,
    setSelectedDay,
    CATEGORIES,
    editingExpenseId,
    handleEditClick,
    handleCancelEdit
}) => {
    if (!selectedDay) return null;

    const dailyExpenses = expenses[selectedDay] || [];
    const dailyTotal = dailyExpenses.reduce((sum, exp) => {
        return exp.type === 'income' ? sum + exp.amount : sum - exp.amount;
    }, 0);

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="w-full max-w-lg p-6 rounded-xl border border-white/20 shadow-2xl
                            backdrop-filter backdrop-blur-xl bg-gray-900/80 text-white">
                
                <h3 className="text-2xl font-bold mb-4 text-red-400">
                    Movimientos del {new Date(selectedDay).toLocaleDateString('es-ES', { dateStyle: 'full' })}
                </h3>
                
                <div className="mb-6 p-4 rounded-lg bg-white/5 border border-white/10">
                    <h4 className="text-xl font-semibold mb-3">{editingExpenseId ? 'Editar Movimiento' : 'Añadir Movimiento'}</h4>
                    
                    <div className="flex p-1 bg-gray-800 rounded-lg mb-4 border border-gray-700">
                        <button 
                            onClick={() => {
                                setExpenseType('expense');
                                if (!CATEGORIES['expense'].includes(expenseCategory)) {
                                    setExpenseCategory(CATEGORIES['expense'][0]);
                                }
                            }}
                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                                expenseType === 'expense' 
                                ? 'bg-red-500 text-white shadow-lg shadow-red-900/50' 
                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                            }`}
                        >
                            <span>📉</span> Gasto
                        </button>
                        <button 
                            onClick={() => {
                                setExpenseType('income');
                                if (!CATEGORIES['income'].includes(expenseCategory)) {
                                    setExpenseCategory(CATEGORIES['income'][0]);
                                }
                            }}
                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                                expenseType === 'income' 
                                ? 'bg-green-500 text-white shadow-lg shadow-green-900/50' 
                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                            }`}
                        >
                            <span>📈</span> Ingreso
                        </button>
                    </div>

                    <div className="flex gap-2 mb-3">
                        <input
                            type="number"
                            placeholder="Monto (€)"
                            value={expenseAmount}
                            onChange={(e) => setExpenseAmount(e.target.value)}
                            className="flex-1 p-3 bg-gray-800 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:ring-red-500 focus:border-red-500"
                        />
                        <select
                            value={expenseCategory}
                            onChange={(e) => setExpenseCategory(e.target.value)}
                            className="flex-1 p-3 bg-gray-800 border border-white/20 rounded-lg text-white focus:ring-red-500 focus:border-red-500"
                        >
                            {(CATEGORIES[expenseType] || []).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <textarea
                        rows="2" 
                        placeholder="Descripción (opcional)"
                        value={expenseDescription}
                        onChange={(e) => setExpenseDescription(e.target.value)}
                        className="w-full p-3 mb-4 bg-gray-800 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:ring-red-500 focus:border-red-500 resize-none"
                    />
                    <div className="flex gap-2">
                        {editingExpenseId && (
                            <button
                                onClick={handleCancelEdit}
                                className="w-1/3 p-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold transition"
                            >
                                Cancelar
                            </button>
                        )}
                        <button
                            onClick={handleAddExpense}
                            className={`flex-1 p-3 rounded-lg font-bold transition shadow-lg ${expenseType === 'income' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/50' : 'bg-red-600 hover:bg-red-700 shadow-red-500/50'}`}
                        >
                            {editingExpenseId ? 'Actualizar' : 'Guardar'} {expenseType === 'income' ? 'Ingreso' : 'Gasto'}
                        </button>
                    </div>
                </div>

                {dailyExpenses.length > 0 ? (
                    <div className="mt-4 max-h-40 overflow-y-auto pr-2">
                        <p className="font-semibold text-lg mb-2">Balance del Día: <span className={dailyTotal >= 0 ? "text-green-400" : "text-red-400"}>{dailyTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></p>
                        {dailyExpenses.map((exp) => {
                            const isAdjustment = exp.description && exp.description.includes('Checkpoint');
                            return (
                                <div key={exp.id} className={`flex justify-between items-center py-2 border-b border-gray-700 last:border-b-0 ${editingExpenseId === exp.id ? 'bg-white/10 rounded px-2' : ''}`}>
                                    <div className="flex flex-col overflow-hidden mr-2">
                                        <span className={`text-sm font-bold truncate ${isAdjustment ? 'text-yellow-400' : ''}`}>{exp.category || 'General'}</span>
                                        <span className={`text-xs truncate ${isAdjustment ? 'text-yellow-200/70' : 'text-gray-400'}`}>{exp.description}</span>
                                    </div>
                                    <div className="flex items-center flex-shrink-0">
                                        <span className={`font-mono mr-3 ${isAdjustment ? 'text-yellow-400' : (exp.type === 'income' ? 'text-green-400' : 'text-red-300')}`}>
                                            {exp.type === 'income' ? '+' : '-'}{exp.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                        </span>
                                        <button
                                            onClick={() => handleEditClick(exp)}
                                            className="text-gray-400 hover:text-blue-400 transition mr-2"
                                            title="Editar"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteExpense(exp.id)}
                                            className="text-gray-400 hover:text-red-500 transition"
                                            title="Eliminar"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-center text-gray-400 mt-4">No hay movimientos registrados para este día.</p>
                )}

                <button
                    onClick={() => setSelectedDay(null)}
                    className="mt-6 w-full p-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition"
                >
                    Cerrar
                </button>
            </div>
        </div>
    );
};

const SummaryCard = ({ title, value, subtitle, color = "text-red-300", onAdjust, secondaryValue }) => (
    <div className="p-5 rounded-2xl border border-white/10 shadow-lg 
                    backdrop-filter backdrop-blur-lg bg-neutral-950/50 relative group">
        <p className="text-sm font-light text-gray-300">{title}</p>
        <p className={`text-4xl font-extrabold mt-1 ${color}`}>
            {value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
        </p>
        {secondaryValue && (
            <p className="text-sm font-mono text-gray-400 mt-1 opacity-80">
                {secondaryValue}
            </p>
        )}
        <p className="text-xs text-gray-400 mt-2">{subtitle}</p>
        {onAdjust && (
            <button 
                onClick={onAdjust}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white hover:bg-gray-200 rounded-lg text-black text-xs font-bold shadow-lg"
                title="Ajustar Saldo"
            >
                🎯 Ajustar
            </button>
        )}
    </div>
);

const CategoryDetailModal = ({ category, expenses, onClose, onEditExpense }) => {
    if (!category) return null;

    const categoryExpenses = expenses.filter(e => e.category === category).sort((a, b) => new Date(b.date) - new Date(a.date));
    const total = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-700 max-h-[80vh] flex flex-col">
                <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <span>📂</span> {category}
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">Desglose de gastos</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg">
                        ✕
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <div className="bg-gray-700/30 rounded-xl p-4 mb-6 border border-gray-700 flex justify-between items-center">
                        <span className="text-gray-300">Total Gastado</span>
                        <span className="text-2xl font-bold text-white">{total.toFixed(2)}€</span>
                    </div>

                    {categoryExpenses.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No hay gastos registrados en esta categoría este mes.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {categoryExpenses.map(expense => (
                                <div 
                                    key={expense.id}
                                    onClick={() => onEditExpense(expense)}
                                    className="bg-gray-700/40 p-4 rounded-xl border border-gray-700/50 hover:border-blue-500/50 hover:bg-gray-700 transition-all cursor-pointer group"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-medium text-white group-hover:text-blue-400 transition-colors">
                                                {expense.description}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
                                                    {new Date(expense.date).toLocaleDateString()}
                                                </span>
                                                {expense.account && (
                                                    <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        💳 {expense.account}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="font-bold text-red-400">
                                            -{expense.amount.toFixed(2)}€
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const CheckpointModal = ({ onClose, onSave, currentAccounts }) => {
    const [date, setDate] = useState(formatYYYYMMDD(new Date()));
    const [accounts, setAccounts] = useState(currentAccounts || { bbva: 0, revolut: 0, cash: 0 });

    const handleAccountChange = (e) => {
        const { name, value } = e.target;
        setAccounts(prev => ({
            ...prev,
            [name]: parseFloat(value) || 0
        }));
    };

    const totalBalance = Object.values(accounts).reduce((sum, val) => sum + val, 0);

    const handleSubmit = () => {
        onSave(date, totalBalance, accounts);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="w-full max-w-md p-6 rounded-3xl border border-white/10 shadow-2xl bg-neutral-950 text-white">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-purple-400 flex items-center gap-2">
                        <span>🎯</span> Ajustar Saldo Real
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                </div>
                
                <p className="text-gray-400 text-sm mb-6 bg-white/5 p-3 rounded-xl border border-white/5">
                    Actualiza el saldo real de tus cuentas. La app calculará la diferencia y creará un movimiento de ajuste automáticamente.
                </p>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider font-bold">Fecha del Ajuste</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full p-3 bg-black border border-white/20 rounded-xl focus:border-purple-500 text-white"
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="block text-xs text-gray-500 uppercase tracking-wider font-bold">Saldos por Cuenta</label>
                        
                        <div className="flex items-center justify-between bg-neutral-900 p-3 rounded-xl border border-white/5">
                            <span className="text-blue-300 font-medium">BBVA</span>
                            <input
                                type="number"
                                name="bbva"
                                step="0.01"
                                value={accounts.bbva}
                                onChange={handleAccountChange}
                                className="w-32 bg-transparent text-right font-mono text-white focus:outline-none border-b border-white/20 focus:border-blue-500"
                            />
                        </div>

                        <div className="flex items-center justify-between bg-neutral-900 p-3 rounded-xl border border-white/5">
                            <span className="text-pink-300 font-medium">Revolut</span>
                            <input
                                type="number"
                                name="revolut"
                                step="0.01"
                                value={accounts.revolut}
                                onChange={handleAccountChange}
                                className="w-32 bg-transparent text-right font-mono text-white focus:outline-none border-b border-white/20 focus:border-pink-500"
                            />
                        </div>

                        <div className="flex items-center justify-between bg-neutral-900 p-3 rounded-xl border border-white/5">
                            <span className="text-green-300 font-medium">Efectivo</span>
                            <input
                                type="number"
                                name="cash"
                                step="0.01"
                                value={accounts.cash}
                                onChange={handleAccountChange}
                                className="w-32 bg-transparent text-right font-mono text-white focus:outline-none border-b border-white/20 focus:border-green-500"
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                        <span className="text-gray-400">Total Real:</span>
                        <span className="text-2xl font-bold text-white">{totalBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                    </div>
                </div>

                <button
                    onClick={handleSubmit}
                    className="w-full p-4 bg-white text-black hover:bg-gray-200 rounded-xl font-bold transition shadow-lg shadow-white/10 flex items-center justify-center gap-2"
                >
                    <span>💾</span> Guardar y Ajustar
                </button>
            </div>
        </div>
    );
};

const LoginScreen = ({ onLogin }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <div className="text-center mb-8">
            <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-4">
                Finanzas App
            </h1>
            <p className="text-gray-400 text-lg">Tu control financiero personal en la nube.</p>
        </div>
        <button
            onclick={onLogin}
            className="flex items-center gap-3 px-8 py-4 bg-white text-gray-900 rounded-full font-bold text-lg hover:bg-gray-100 transition shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
        >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
            Iniciar Sesión con Google
        </button>
    </div>
);

const AnalyticsView = ({ expenses, currentDate }) => {
    const currentMonthExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === currentDate.getMonth() && 
               expenseDate.getFullYear() === currentDate.getFullYear() &&
               expense.type === 'expense';
    });

    const data = currentMonthExpenses.reduce((acc, curr) => {
        const cat = curr.category || 'Otros';
        const existing = acc.find(item => item.name === cat);
        if (existing) {
            existing.value += curr.amount;
        } else {
            acc.push({ name: cat, value: curr.amount });
        }
        return acc;
    }, []);

    // Colores solicitados: Blanco, Negro (no visible en fondo negro), Verde ligero, Rojo ligero, Azul ligero, Grises
    const COLORS = ['#d8b4fe', '#86efac', '#fca5a5', '#93c5fd', '#cbd5e1', '#525252'];

    return (
        <div className="bg-black p-6 rounded-2xl border border-white/10 shadow-xl mb-8">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span>📈</span> Análisis de Gastos
            </h3>
            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#000000', borderColor: '#333333', color: '#fff' }}
                            formatter={(value) => `${value.toFixed(2)}€`} 
                        />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default App;