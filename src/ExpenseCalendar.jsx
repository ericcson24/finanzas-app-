import React, { useState, useEffect, useMemo } from 'react';
import { fetchExpenses, saveExpense, deleteExpense, fetchFinancialProfile, saveFinancialProfile, saveAllExpenses } from './firebaseService'; // Import Firebase services
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

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

const BudgetOverview = ({ budgets, expenses, currentDate, onCategoryClick }) => {
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
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 mb-8">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span>📊</span> Estado del Presupuesto Mensual
            </h3>
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
                            className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors"
                        >
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-medium text-gray-200">{cat}</span>
                                <span className={`text-sm font-bold ${isOverBudget ? 'text-red-400' : 'text-green-400'}`}>
                                    {spent.toFixed(2)}€ / {budget}€
                                </span>
                            </div>
                            <div className="w-full bg-gray-600 rounded-full h-2.5">
                                <div 
                                    className={`h-2.5 rounded-full transition-all duration-500 ${
                                        isOverBudget ? 'bg-red-500' : 
                                        percentage > 80 ? 'bg-yellow-500' : 'bg-green-500'
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            </div>
                            <div className="text-xs text-gray-400 mt-1 text-right">
                                {budget > 0 ? `${percentage.toFixed(1)}%` : 'Sin presupuesto'}
                            </div>
                        </div>
                    );
                })}
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
        }
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
                        setFinancialProfile(loadedProfile);
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
                    budgets: { 'Comidas': 0, 'Planes': 0, 'Regalos': 0, 'Suscripciones': 0, 'Caprichos': 0, 'Otros': 0 }
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

    if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Cargando...</div>;
    if (!user) return <LoginScreen onLogin={handleLogin} />;
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);

    const [currentDate, setCurrentDate] = useState(new Date()); 
    const [selectedDay, setSelectedDay] = useState(null); 
    
    // Estados del formulario
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expenseType, setExpenseType] = useState('expense'); // 'expense' o 'income'
    const [expenseCategory, setExpenseCategory] = useState('Otros');
    const [editingExpenseId, setEditingExpenseId] = useState(null);

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
                    } else {
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

    const accumulatedCushion = useMemo(() => {
        // Calcular el último día del mes que se está visualizando
        const endOfViewedMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
        
        const totalBalance = allExpensesArray.reduce((acc, exp) => {
            const expDate = new Date(exp.date);
            // Solo sumar gastos/ingresos hasta el final del mes visualizado
            if (expDate <= endOfViewedMonth) {
                return acc + (exp.type === 'income' ? exp.amount : -exp.amount);
            }
            return acc;
        }, 0);
        return (financialProfile.initialBase || 0) + totalBalance;
    }, [allExpensesArray, financialProfile.initialBase, currentDate]);

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
                
                if (importedData.expenses) {
                    setExpenses(importedData.expenses);
                    saveAllExpenses(importedData.expenses);
                    
                    if (importedData.financialProfile) {
                        setFinancialProfile(importedData.financialProfile);
                        saveFinancialProfile(importedData.financialProfile);
                    }
                } else {
                    setExpenses(importedData);
                    saveAllExpenses(importedData);
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

    const handleCreateCheckpoint = (date, actualBalance) => {
        const targetDate = new Date(date);
        // Asegurar que comparamos hasta el final del día seleccionado
        const endOfTargetDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

        const expensesUpToDate = allExpensesArray.filter(exp => new Date(exp.date) <= endOfTargetDate);
        
        const calculatedBalance = (financialProfile.initialBase || 0) + expensesUpToDate.reduce((acc, exp) => {
            return acc + (exp.type === 'income' ? exp.amount : -exp.amount);
        }, 0);

        const difference = actualBalance - calculatedBalance;

        if (Math.abs(difference) < 0.01) {
            alert("✅ El balance calculado ya coincide con el real. No es necesario ajustar.");
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

    return (
        <div className="min-h-screen bg-gray-950 text-white font-sans flex flex-col items-center p-4">
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
            `}</style>
            
            {/* Contenedor Principal con Efecto Frosted Glass */}
            <div className="w-full max-w-5xl p-6 rounded-3xl shadow-2xl border border-white/20 
                            backdrop-filter backdrop-blur-3xl bg-gray-800/60 transition duration-500">

                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
                        Calendario Financiero
                    </h1>
                    <div className="flex gap-4 items-center">
                        <span className="text-sm text-gray-400 hidden md:inline">Hola, {user.displayName}</span>
                        <button 
                            onClick={() => setIsConfigOpen(true)}
                            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition border border-gray-700"
                            title="Configuración"
                        >
                            ⚙️
                        </button>
                        <button 
                            onClick={handleLogout}
                            className="p-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition border border-red-900/50"
                            title="Cerrar Sesión"
                        >
                            🚪
                        </button>
                    </div>
                </div>

                <DashboardStats 
                    expenses={expenses} 
                    currentDate={currentDate}
                    financialProfile={financialProfile}
                    accumulatedCushion={accumulatedCushion}
                    onOpenCheckpoint={() => setIsCheckpointModalOpen(true)}
                />

                <AnalyticsView expenses={allExpensesArray} currentDate={currentDate} />

                <BudgetOverview 
                    budgets={financialProfile.budgets}
                    expenses={allExpensesArray}
                    currentDate={currentDate}
                    onCategoryClick={handleCategoryClick}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <SummaryCard 
                        title="Ingresos" 
                        value={monthlyStats.income} 
                        subtitle="Total Ingresado"
                        color="text-green-400"
                    />
                    <SummaryCard 
                        title="Gastos" 
                        value={monthlyStats.expense} 
                        subtitle="Total Gastado"
                        color="text-red-400"
                    />
                    <SummaryCard 
                        title="Balance" 
                        value={monthlyStats.balance} 
                        subtitle="Diferencia"
                        color={monthlyStats.balance >= 0 ? "text-blue-400" : "text-orange-400"}
                    />
                    <SummaryCard 
                        title="Colchón Acumulado" 
                        value={accumulatedCushion} 
                        subtitle={`Hasta final de ${monthNames[currentDate.getMonth()]}`}
                        color={accumulatedCushion >= 0 ? "text-purple-400" : "text-pink-400"}
                    />
                </div>

                <Calendar 
                    currentDate={currentDate}
                    navigateMonth={navigateMonth}
                    calendarWeeks={calendarWeeks}
                    handleDayClick={handleDayClick}
                    selectedDay={selectedDay}
                    weeklyTotals={weeklyTotals}
                    expenses={expenses}
                />
                
                <p className="mt-8 text-xs text-center text-gray-400 break-all">
                    Modo Local - Datos guardados en tu navegador
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
                />
            )}
        </div>
    );
};

const DashboardStats = ({ financialProfile, currentDate, expenses, accumulatedCushion, onOpenCheckpoint }) => {
    const { monthlySalary, payday, savingsTarget } = financialProfile;
    
    const today = new Date();
    let nextPaydayDate = new Date(today.getFullYear(), today.getMonth(), payday);
    if (today.getDate() > payday) {
        nextPaydayDate = new Date(today.getFullYear(), today.getMonth() + 1, payday);
    }
    const daysUntilPayday = Math.ceil((nextPaydayDate - today) / (1000 * 60 * 60 * 24));

    // Calcular balance efectivo (Proyección)
    // Si no se ha ingresado la nómina como transacción, se asume el salario base para la proyección
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
                        // Asumimos que es la nómina si la categoría es Nómina o el monto es similar al salario (>90%)
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

    // Balance proyectado: Si ya cobraste (transacción), usa el real. Si no, suma el salario base al balance actual.
    const projectedBalance = salaryReceived ? (totalIncome - totalExpense) : (totalIncome + monthlySalary - totalExpense);
    
    const savingsProgress = savingsTarget > 0 ? Math.min((projectedBalance / savingsTarget) * 100, 100) : 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-xl border border-white/10 bg-gray-800/50 backdrop-blur-md flex flex-col items-center justify-center">
                <span className="text-gray-400 text-sm mb-1">Próximo Cobro</span>
                <div className="text-3xl font-bold text-blue-400">{daysUntilPayday} días</div>
                <span className="text-xs text-gray-500">Día {payday} de cada mes</span>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-gray-800/50 backdrop-blur-md flex flex-col justify-center">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-gray-400 text-sm">Meta de Ahorro (Est.)</span>
                    <span className="text-xs text-gray-500">{projectedBalance.toLocaleString()} / {savingsTarget.toLocaleString()} €</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-500 ${projectedBalance >= savingsTarget ? 'bg-green-500' : 'bg-yellow-500'}`}
                        style={{ width: `${Math.max(0, savingsProgress)}%` }}
                    ></div>
                </div>
                <span className="text-xs text-center mt-2 text-gray-400">
                    {projectedBalance >= savingsTarget ? '¡Meta proyectada alcanzada! 🎉' : `${(savingsTarget - projectedBalance).toLocaleString()} € para la meta`}
                </span>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-gray-800/50 backdrop-blur-md flex flex-col items-center justify-center">
                <span className="text-gray-400 text-sm mb-1">Salario Base</span>
                <div className="text-3xl font-bold text-green-400">
                    {Number(monthlySalary).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </div>
                <span className="text-xs text-gray-500">Mensual neto</span>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-gray-800/50 backdrop-blur-md flex flex-col items-center justify-center relative group">
                <span className="text-gray-400 text-sm mb-1">Dinero Hoy</span>
                <div className="text-3xl font-bold text-purple-400">
                    {accumulatedCushion.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </div>
                <span className="text-xs text-gray-500">Saldo Acumulado Real</span>
                <button 
                    onClick={onOpenCheckpoint}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-xs font-bold shadow-lg"
                    title="Ajustar Saldo Real (Checkpoint)"
                >
                    🎯 Ajustar
                </button>
            </div>
        </div>
    );
};

const FinancialProfileModal = ({ profile, onSave, onClose }) => {
    const [formData, setFormData] = useState(profile);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleAccountChange = (e) => {
        // Deprecated: Accounts are no longer used individually
    };

    const handleBudgetChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            budgets: {
                ...prev.budgets,
                [name]: value
            }
        }));
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
            budgets: formData.budgets || {}
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-4xl p-6 rounded-xl border border-white/20 shadow-2xl bg-gray-900 text-white my-8">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-blue-400">Configuración Financiera</h3>
                    <label className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm font-bold cursor-pointer transition shadow-lg shadow-green-500/30 flex items-center gap-2">
                        <span>📄</span> Escanear Plan Financiero (Excel)
                        <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="hidden" />
                    </label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Sección General */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-gray-300 border-b border-gray-700 pb-2">Perfil General</h4>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Salario Mensual Neto (€)</label>
                            <input
                                type="number"
                                name="monthlySalary"
                                value={formData.monthlySalary}
                                onChange={handleChange}
                                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Día de Cobro (1-31)</label>
                            <input
                                type="number"
                                name="payday"
                                min="1"
                                max="31"
                                value={formData.payday}
                                onChange={handleChange}
                                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Meta de Ahorro Mensual (€)</label>
                            <input
                                type="number"
                                name="savingsTarget"
                                value={formData.savingsTarget}
                                onChange={handleChange}
                                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Sección Colchón */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-gray-300 border-b border-gray-700 pb-2">Colchón Financiero</h4>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Dinero Base Inicial (€)</label>
                            <p className="text-xs text-gray-500 mb-2">Saldo total acumulado antes de empezar a usar la app.</p>
                            <input
                                type="number"
                                name="initialBase"
                                value={formData.initialBase || 0}
                                onChange={handleChange}
                                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                            />
                        </div>
                    </div>

                    {/* Sección Presupuestos (Plan Financiero) */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-gray-300 border-b border-gray-700 pb-2">Plan de Gastos (Mensual)</h4>
                        {['Comidas', 'Planes', 'Regalos', 'Suscripciones', 'Caprichos', 'Otros'].map(cat => (
                            <div key={cat}>
                                <label className="block text-sm text-gray-400 mb-1">{cat} (€)</label>
                                <input
                                    type="number"
                                    name={cat}
                                    value={formData.budgets?.[cat] || 0}
                                    onChange={handleBudgetChange}
                                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-green-500 focus:border-green-500"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button
                        onClick={onClose}
                        className="flex-1 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="flex-1 p-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition shadow-lg shadow-blue-500/50"
                    >
                        Guardar Cambios
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
                className="p-2 text-white hover:text-red-400 transition"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>
            <h2 className="text-3xl font-extrabold text-white">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button 
                onClick={() => navigateMonth(1)}
                className="p-2 text-white hover:text-red-400 transition"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
        </div>
        
        <div className="grid grid-cols-8 text-center font-semibold text-red-400 text-sm">
            {daysOfWeek.map(day => (
                <div key={day} className="p-3 border-b border-gray-700/50">{day}</div>
            ))}
            <div className="p-3 border-b border-red-500/80 bg-red-900/10 text-white font-bold">TOTAL SEMANA</div>
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
                                backdrop-filter backdrop-blur-md bg-white/5 border border-white/10
                                hover:bg-white/10 rounded-lg
                                ${day.isCurrentMonth ? 'text-white' : 'text-gray-400 opacity-60'}
                                ${isToday ? 'border-2 border-red-500 ring-2 ring-red-500' : ''}
                                ${isSelected ? 'bg-red-900/40 border-red-500' : ''}
                            `}
                        >
                            <span className="text-lg font-medium">{day.date.getDate()}</span>
                            <ExpenseSummary dateKey={day.dateKey} expenses={expenses} />
                        </div>
                    );
                })}

                <div className="flex items-center justify-center p-2 rounded-lg 
                                backdrop-filter backdrop-blur-md bg-red-900/20 border border-red-700/50">
                    <span className="text-xl font-extrabold text-red-300">
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
                            className="flex-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-red-500 focus:border-red-500"
                        />
                        <select
                            value={expenseCategory}
                            onChange={(e) => setExpenseCategory(e.target.value)}
                            className="flex-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-red-500 focus:border-red-500"
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
                        className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-red-500 focus:border-red-500 resize-none"
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

const SummaryCard = ({ title, value, subtitle, color = "text-red-300" }) => (
    <div className="p-5 rounded-2xl border border-white/10 shadow-lg 
                    backdrop-filter backdrop-blur-lg bg-gray-900/40">
        <p className="text-sm font-light text-gray-300">{title}</p>
        <p className={`text-4xl font-extrabold mt-1 ${color}`}>
            {value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
        </p>
        <p className="text-xs text-gray-400 mt-2">{subtitle}</p>
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

const CheckpointModal = ({ onClose, onSave }) => {
    const [date, setDate] = useState(formatYYYYMMDD(new Date()));
    const [amount, setAmount] = useState('');

    const handleSubmit = () => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) {
            alert("Por favor, introduce una cantidad válida.");
            return;
        }
        onSave(date, numAmount);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="w-full max-w-md p-6 rounded-xl border border-white/20 shadow-2xl bg-gray-900 text-white">
                <h3 className="text-2xl font-bold text-purple-400 mb-2">🎯 Ajustar Saldo Real</h3>
                <p className="text-gray-400 text-sm mb-6">
                    Introduce el saldo real que tienes en tus cuentas en la fecha seleccionada. 
                    La aplicación creará automáticamente un movimiento de ajuste para que los números cuadren.
                </p>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Fecha del Checkpoint</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Saldo Real Total (€)</label>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="Ej: 1236.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-white font-bold text-lg"
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="flex-1 p-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold transition shadow-lg shadow-purple-500/30"
                    >
                        Ajustar Balance
                    </button>
                </div>
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
            onClick={onLogin}
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

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 mb-8">
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
                        <Tooltip formatter={(value) => `${value.toFixed(2)}€`} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default App;