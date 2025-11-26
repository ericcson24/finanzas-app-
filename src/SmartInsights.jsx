import React from 'react';

const SmartInsights = ({ expenses, currentDate, financialProfile, accumulatedCushion }) => {
    const currentMonthExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === currentDate.getMonth() && 
               expenseDate.getFullYear() === currentDate.getFullYear();
    });

    const totalSpent = currentMonthExpenses.reduce((sum, exp) => exp.type === 'expense' ? sum + exp.amount : sum, 0);
    const totalIncome = currentMonthExpenses.reduce((sum, exp) => exp.type === 'income' ? sum + exp.amount : sum, 0);
    
    const insights = [];
    const today = new Date();
    const isCurrentMonth = currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const currentDay = isCurrentMonth ? today.getDate() : daysInMonth;
    const remainingDays = daysInMonth - currentDay;

    // --- HELPER FUNCTIONS ---
    const addInsight = (type, title, text, details, score = 1) => {
        insights.push({ type, title, text, details, score });
    };

    // ==========================================
    // 1. ANÁLISIS DE TIEMPO Y PATRONES
    // ==========================================
    
    // 1.1 Proyección Básica
    if (isCurrentMonth && currentDay > 1) {
        const dailyAverage = totalSpent / currentDay;
        const projectedTotal = dailyAverage * daysInMonth;
        const budgetTotal = Object.values(financialProfile.monthlyBudgets?.[`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`] || financialProfile.budgets || {}).reduce((a, b) => a + b, 0);

        if (projectedTotal > budgetTotal && budgetTotal > 0) {
            addInsight('warning', '⚠️ Alerta de Proyección', `Proyección: ${projectedTotal.toFixed(0)}€ (Presupuesto: ${budgetTotal}€)`, `Reduce tu gasto diario a ${Math.max(0, (budgetTotal - totalSpent) / remainingDays).toFixed(0)}€ para cumplir.`, 10);
        }
    }

    // 1.2 Weekend Warrior (Gasto Fin de Semana)
    const weekendSpend = currentMonthExpenses.reduce((sum, exp) => {
        const d = new Date(exp.date);
        const day = d.getDay();
        return (day === 0 || day === 6) && exp.type === 'expense' ? sum + exp.amount : sum;
    }, 0);
    if (totalSpent > 0 && (weekendSpend / totalSpent) > 0.5) {
        addInsight('info', '🎉 Fiebre de Sábado Noche', `El ${((weekendSpend / totalSpent) * 100).toFixed(0)}% de tu gasto es en fin de semana.`, 'Tus lunes a viernes son muy austeros, pero te descontrolas el finde.', 5);
    }

    // 1.3 Lunes de Arrepentimiento
    const mondaySpend = currentMonthExpenses.reduce((sum, exp) => {
        const d = new Date(exp.date);
        return d.getDay() === 1 && exp.type === 'expense' ? sum + exp.amount : sum;
    }, 0);
    if (totalSpent > 0 && (mondaySpend / totalSpent) > 0.25) {
        addInsight('info', '☕ Lunes Costosos', 'Gastas mucho los lunes.', '¿Compensación emocional por el inicio de semana?', 3);
    }

    // 1.4 Efecto "Principio de Mes"
    const firstWeekSpend = currentMonthExpenses.reduce((sum, exp) => {
        return new Date(exp.date).getDate() <= 7 && exp.type === 'expense' ? sum + exp.amount : sum;
    }, 0);
    if (totalSpent > 0 && (firstWeekSpend / totalSpent) > 0.6) {
        addInsight('warning', '🏎️ Salida en Falso', 'Gastaste el 60% de tu dinero la primera semana.', 'Intenta dosificar para no sufrir a fin de mes.', 8);
    }

    // 1.5 Efecto "Fin de Mes" (Supervivencia)
    if (isCurrentMonth && currentDay > 20 && (totalSpent / (totalIncome || 1)) > 0.9) {
        addInsight('warning', '🆘 Modo Supervivencia', 'Te queda menos del 10% de tus ingresos.', 'Evita gastos hormiga estos últimos días.', 9);
    }

    // 1.6 Análisis Horario (Nocturno)
    const nightSpend = currentMonthExpenses.filter(e => {
        if (!e.createdAt) return false;
        const hour = new Date(e.createdAt).getHours();
        return (hour >= 23 || hour <= 4) && e.type === 'expense';
    });
    if (nightSpend.length > 2) {
        addInsight('info', '🦉 Gasto Nocturno', `Has hecho ${nightSpend.length} compras de madrugada.`, 'Las compras nocturnas suelen ser impulsivas.', 4);
    }

    // 1.7 Racha de Días Sin Gasto
    const daysWithExpenses = new Set(currentMonthExpenses.filter(e => e.type === 'expense').map(e => new Date(e.date).getDate()));
    const zeroSpendDays = currentDay - daysWithExpenses.size;
    if (zeroSpendDays > 5) {
        addInsight('success', '🛡️ Escudo de Ahorro', `${zeroSpendDays} días sin gastar nada.`, '¡Excelente disciplina!', 6);
    }

    // 1.8 Gasto Diario Promedio
    if (currentDay > 0) {
        const dailyAvg = totalSpent / currentDay;
        addInsight('neutral', '📅 Coste de Vida Diario', `Te cuesta ${dailyAvg.toFixed(1)}€ vivir cada día.`, 'Incluye todos tus gastos promediados.', 2);
    }

    // 1.9 Derroche en Día de Cobro
    if (financialProfile.payday) {
        const paydaySpend = currentMonthExpenses.filter(e => new Date(e.date).getDate() === financialProfile.payday && e.type === 'expense')
            .reduce((sum, e) => sum + e.amount, 0);
        if (paydaySpend > totalSpent * 0.15) {
            addInsight('warning', '💸 Euforia de Cobro', 'Gastaste el 15% de tu mes el mismo día que cobraste.', 'Cuidado con el efecto riqueza instantánea.', 6);
        }
    }

    // 1.10 Síndrome del Viernes
    const fridaySpend = currentMonthExpenses.reduce((sum, exp) => {
        const d = new Date(exp.date);
        return d.getDay() === 5 && exp.type === 'expense' ? sum + exp.amount : sum;
    }, 0);
    if (fridaySpend > totalSpent * 0.2) {
        addInsight('info', '🍻 TGIF (Viernes)', 'Los viernes se llevan el 20% de tu presupuesto.', '¿Cenas fuera o copas?', 3);
    }

    // ==========================================
    // 2. ANÁLISIS DE CATEGORÍAS
    // ==========================================

    const catTotals = {};
    currentMonthExpenses.forEach(e => {
        if (e.type === 'expense') catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
    });

    // 2.1 Dependencia de "Otros"
    if ((catTotals['Otros'] || 0) / totalSpent > 0.3) {
        addInsight('warning', '🕳️ Agujero Negro', 'El 30% de tus gastos están en "Otros".', 'Categoriza mejor para saber dónde se va el dinero.', 7);
    }

    // 2.2 Caprichos vs Necesidad
    const wants = (catTotals['Caprichos'] || 0) + (catTotals['Planes'] || 0) + (catTotals['Regalos'] || 0);
    const needs = totalSpent - wants;
    if (totalSpent > 0 && wants > needs) {
        addInsight('warning', '⚖️ Desequilibrio Deseo/Necesidad', 'Gastas más en deseos que en necesidades.', 'Revisa tus prioridades si quieres ahorrar más.', 6);
    }

    // 2.3 Suscripciones Silenciosas
    const subExpenses = currentMonthExpenses.filter(e => e.category === 'Suscripciones');
    if (subExpenses.length > 4) {
        addInsight('warning', '📺 Fatiga de Suscripciones', `Tienes ${subExpenses.length} cargos de suscripción distintos.`, '¿Realmente usas todos esos servicios?', 5);
    }

    // 2.4 Inflación de Comida
    const foodAvg = 150; 
    if ((catTotals['Comidas'] || 0) > foodAvg * 1.5) {
        addInsight('info', '🍔 Amante del Buen Comer', 'Tu gasto en comida es un 50% superior al promedio base.', 'Cocinar en casa podría ahorrarte mucho.', 4);
    }

    // 2.5 Regalos Generosos
    if ((catTotals['Regalos'] || 0) > 100) {
        addInsight('success', '🎁 Espíritu Generoso', `Has destinado ${catTotals['Regalos']}€ a los demás.`, 'La generosidad es buena, pero vigila tu presupuesto.', 3);
    }

    // 2.6 Diversificación de Gasto
    const activeCategories = Object.keys(catTotals).length;
    if (activeCategories < 3 && totalSpent > 100) {
        addInsight('info', '🎯 Gasto Monotemático', 'Tus gastos se concentran en muy pocas categorías.', 'Patrón de consumo muy específico.', 2);
    }

    // 2.7 Detección de Café (Gastos pequeños recurrentes en Comidas)
    const coffees = currentMonthExpenses.filter(e => e.category === 'Comidas' && e.amount < 5).length;
    if (coffees > 10) {
        addInsight('info', '☕ Factor Latte', `Has hecho ${coffees} micro-gastos en comida/café.`, 'Esos pequeños gastos suman mucho a fin de mes.', 4);
    }

    // 2.8 Guerra de Streaming
    const streamingKeywords = ['netflix', 'hbo', 'disney', 'prime', 'spotify', 'youtube'];
    const streamingCount = subExpenses.filter(e => streamingKeywords.some(k => e.description?.toLowerCase().includes(k))).length;
    if (streamingCount >= 3) {
        addInsight('info', '🎬 Guerra de Streaming', `Pagas ${streamingCount} plataformas de video/música.`, '¿Te da tiempo a verlo todo?', 3);
    }

    // 2.9 Gamer Alert
    const gamingKeywords = ['steam', 'playstation', 'xbox', 'nintendo', 'game'];
    const gamingSpend = currentMonthExpenses.filter(e => gamingKeywords.some(k => e.description?.toLowerCase().includes(k))).reduce((s,e)=>s+e.amount,0);
    if (gamingSpend > 50) {
        addInsight('info', '🎮 Gamer Detectado', `Has invertido ${gamingSpend}€ en videojuegos.`, '¡GG WP!', 2);
    }

    // 2.10 Fashionista
    const fashionKeywords = ['zara', 'h&m', 'mango', 'bershka', 'pull', 'stradivarius', 'nike', 'adidas'];
    const fashionSpend = currentMonthExpenses.filter(e => fashionKeywords.some(k => e.description?.toLowerCase().includes(k))).reduce((s,e)=>s+e.amount,0);
    if (fashionSpend > 100) {
        addInsight('info', '👗 Fashionista', `Has gastado ${fashionSpend}€ en marcas de ropa conocidas.`, '¿Renovando armario?', 3);
    }

    // 2.11 Comida Rápida
    const fastFoodKeywords = ['mcdonalds', 'burger', 'kfc', 'pizza', 'taco', 'glovo', 'uber eats', 'just eat'];
    const fastFoodCount = currentMonthExpenses.filter(e => fastFoodKeywords.some(k => e.description?.toLowerCase().includes(k))).length;
    if (fastFoodCount > 4) {
        addInsight('warning', '🍟 Fast Food Lover', `Has pedido comida rápida ${fastFoodCount} veces.`, 'Tu salud y tu cartera te agradecerán cocinar más.', 5);
    }

    // 2.12 Transporte / Gasolina
    const transportKeywords = ['gasolina', 'repsol', 'cepsa', 'bp', 'uber', 'cabify', 'taxi', 'metro', 'bus', 'renfe'];
    const transportSpend = currentMonthExpenses.filter(e => transportKeywords.some(k => e.description?.toLowerCase().includes(k))).reduce((s,e)=>s+e.amount,0);
    if (transportSpend > 150) {
        addInsight('info', '⛽ Alto Coste de Movilidad', `Te has movido por valor de ${transportSpend}€.`, '¿Podrías optimizar tus rutas?', 4);
    }

    // ==========================================
    // 3. SALUD FINANCIERA Y RATIOS
    // ==========================================

    // 3.1 Regla 50/30/20 (Estimada)
    if (totalIncome > 0) {
        const savingsRate = ((totalIncome - totalSpent) / totalIncome) * 100;
        if (savingsRate >= 20) {
            addInsight('success', '📘 Regla 50/30/20', '¡Cumples la regla del 20% de ahorro!', `Estás ahorrando un ${savingsRate.toFixed(1)}% de tus ingresos.`, 8);
        } else {
            addInsight('info', '📘 Regla 50/30/20', `Ahorro actual: ${savingsRate.toFixed(1)}% (Meta: 20%)`, 'Intenta reducir gastos variables para llegar al 20%.', 5);
        }
    }

    // 3.2 Runway (Meses de Libertad)
    if (accumulatedCushion > 0 && totalSpent > 0) {
        const monthlyBurn = isCurrentMonth ? (totalSpent / currentDay) * daysInMonth : totalSpent;
        const runway = accumulatedCushion / monthlyBurn;
        
        if (runway < 1) {
            addInsight('warning', '🚨 Zona de Peligro', 'Tienes menos de 1 mes de gastos cubiertos.', 'Prioridad absoluta: Construir fondo de emergencia.', 10);
        } else if (runway >= 1 && runway < 3) {
            addInsight('warning', '⚠️ Colchón Fino', `Tienes para ${runway.toFixed(1)} meses.`, 'Lo ideal es llegar a 3-6 meses de seguridad.', 7);
        } else if (runway >= 6) {
            addInsight('success', '🏰 Fortaleza Financiera', `Tienes ${runway.toFixed(1)} meses de libertad.`, 'Considera invertir el excedente.', 8);
        }
    }

    // 3.3 Velocidad de Gasto (Burn Rate Velocity)
    if (isCurrentMonth && currentDay > 10) {
        const firstHalfAvg = currentMonthExpenses.filter(e => new Date(e.date).getDate() <= 15).reduce((s,e)=>s+(e.type==='expense'?e.amount:0),0) / 15;
        const secondHalfAvg = currentMonthExpenses.filter(e => new Date(e.date).getDate() > 15).reduce((s,e)=>s+(e.type==='expense'?e.amount:0),0) / (currentDay - 15);
        
        if (currentDay > 15 && secondHalfAvg > firstHalfAvg * 1.5) {
            addInsight('warning', '📈 Aceleración de Gasto', 'Estás gastando mucho más rápido en la segunda mitad del mes.', '¡Frena un poco!', 6);
        }
    }

    // 3.4 Capacidad de Inversión
    if (accumulatedCushion > 10000 && (totalIncome - totalSpent) > 500) {
        addInsight('action', '🚀 Oportunidad de Inversión', 'Tienes buen colchón y superávit mensual.', '¿Has considerado indexarte o abrir un depósito?', 7);
    }

    // 3.5 Días de Libertad Ganados
    if (totalIncome > 0 && totalSpent > 0) {
        const dailyCost = totalSpent / currentDay;
        const savedAmount = totalIncome - totalSpent;
        if (savedAmount > 0) {
            const daysBought = savedAmount / dailyCost;
            addInsight('success', '⏳ Tiempo Comprado', `Este mes has "comprado" ${daysBought.toFixed(1)} días de libertad futura.`, 'Tu ahorro se traduce en tiempo de vida sin trabajar.', 6);
        }
    }

    // 3.6 Ratio de Vivienda (Estimado)
    const housingKeywords = ['alquiler', 'hipoteca', 'comunidad', 'casero'];
    const housingCost = currentMonthExpenses.filter(e => housingKeywords.some(k => e.description?.toLowerCase().includes(k))).reduce((s,e)=>s+e.amount,0);
    if (totalIncome > 0 && housingCost > 0) {
        const ratio = (housingCost / totalIncome) * 100;
        if (ratio > 40) {
            addInsight('warning', '🏠 Esfuerzo en Vivienda', `Destinas el ${ratio.toFixed(0)}% de tus ingresos a vivienda.`, 'Lo recomendado es no superar el 30-35%.', 6);
        }
    }

    // 3.7 Gasto Seguro Diario (Safe Spend)
    if (isCurrentMonth && remainingDays > 0) {
        const budgetTotal = Object.values(financialProfile.monthlyBudgets?.[`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`] || financialProfile.budgets || {}).reduce((a, b) => a + b, 0);
        if (budgetTotal > 0) {
            const remainingBudget = budgetTotal - totalSpent;
            const safeDaily = Math.max(0, remainingBudget / remainingDays);
            addInsight('neutral', '🛡️ Límite Diario Seguro', `Puedes gastar ${safeDaily.toFixed(0)}€/día el resto del mes.`, 'Si te mantienes ahí, cumplirás el presupuesto.', 8);
        }
    }

    // ==========================================
    // 4. DETECCIÓN DE ANOMALÍAS
    // ==========================================

    // 4.1 Gasto Gigante
    const hugeExpense = currentMonthExpenses.find(e => e.type === 'expense' && e.amount > 300 && e.category !== 'Otros' && !housingKeywords.some(k => e.description?.toLowerCase().includes(k))); 
    if (hugeExpense) {
        addInsight('info', '🦖 Gasto Monstruoso', `Detectado gasto único de ${hugeExpense.amount}€ (${hugeExpense.category}).`, '¿Fue algo planificado o un imprevisto?', 4);
    }

    // 4.2 Micro-transacciones masivas
    const microTx = currentMonthExpenses.filter(e => e.type === 'expense' && e.amount < 2).length;
    if (microTx > 15) {
        addInsight('info', '🐜 Hormiguero', `Tienes ${microTx} gastos menores a 2€.`, 'Cuidado, el dinero se escapa por ahí.', 3);
    }

    // 4.3 Números Redondos (Sospecha de efectivo)
    const roundNumbers = currentMonthExpenses.filter(e => e.type === 'expense' && e.amount % 10 === 0 && e.amount > 10).length;
    if (roundNumbers > 5) {
        addInsight('neutral', '🏧 Efectivo Detectado', `Muchos gastos redondos (${roundNumbers}).`, '¿Son retiradas de cajero? Recuerda desglosar en qué gastaste el efectivo.', 2);
    }

    // 4.4 Duplicados Potenciales
    const potentialDupes = currentMonthExpenses.filter((e, i, arr) => 
        arr.findIndex(x => x.amount === e.amount && x.category === e.category && x.date === e.date && x.id !== e.id) !== -1
    );
    if (potentialDupes.length > 0) {
        addInsight('warning', '👯 Posibles Duplicados', 'Detectados movimientos idénticos el mismo día.', 'Revisa si has metido algún gasto dos veces.', 5);
    }

    // 4.5 Comisión Bancaria
    const feeKeywords = ['comision', 'comisión', 'mantenimiento', 'intereses'];
    const fees = currentMonthExpenses.filter(e => feeKeywords.some(k => e.description?.toLowerCase().includes(k))).reduce((s,e)=>s+e.amount,0);
    if (fees > 0) {
        addInsight('warning', '🏦 Comisiones Bancarias', `Has pagado ${fees}€ en comisiones.`, 'Revisa las condiciones de tu banco o cámbiate.', 4);
    }

    // 4.6 Devoluciones
    const refunds = currentMonthExpenses.filter(e => e.type === 'income' && e.description?.toLowerCase().includes('devoluci'));
    if (refunds.length > 0) {
        addInsight('success', '↩️ Devolución Recibida', 'Has recuperado dinero de una devolución.', 'Asegúrate de que cuadre con el gasto original.', 3);
    }

    // ==========================================
    // 5. GAMIFICACIÓN Y PSICOLOGÍA
    // ==========================================

    // 5.1 Nivel de Ahorrador
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpent) / totalIncome) * 100 : 0;
    let level = 'Novato';
    if (savingsRate > 10) level = 'Aprendiz';
    if (savingsRate > 25) level = 'Ahorrador';
    if (savingsRate > 50) level = 'Maestro';
    if (savingsRate > 70) level = 'Leyenda';
    
    if (totalIncome > 0) {
        addInsight('success', `🏅 Nivel: ${level}`, `Tu tasa de ahorro del ${savingsRate.toFixed(0)}% te otorga el rango de ${level}.`, '¡Sigue subiendo de nivel!', 1);
    }

    // 5.2 Predicción de Fin de Año (Bola de Cristal)
    if (totalIncome > totalSpent) {
        const annualSavings = (totalIncome - totalSpent) * 12;
        addInsight('info', '🔮 Bola de Cristal', `A este ritmo, ahorrarás ${annualSavings.toFixed(0)}€ en un año.`, '¿Qué harías con ese dinero?', 2);
    }

    // 5.3 Terapia de Compras
    if (catTotals['Caprichos'] > 0 && catTotals['Caprichos'] > totalSpent * 0.2) {
        addInsight('info', '🛍️ Terapia de Compras', 'Alto gasto en caprichos detectado.', '¿Estás comprando por necesidad o por emoción?', 4);
    }

    // 5.4 Transferencia Inteligente (BBVA -> Revolut)
    const accounts = financialProfile.accounts || { bbva: 0, revolut: 0 };
    const pockets = financialProfile.pockets || { expenses: 0, subscriptions: 0, travel: 0, flexible: 0 };
    const totalRevolutNeeds = (pockets.expenses || 0) + (pockets.subscriptions || 0) + (pockets.travel || 0) + (pockets.flexible || 0);
    const revolutGap = totalRevolutNeeds - (accounts.revolut || 0);

    if (revolutGap > 0) {
        addInsight('action', '💸 Transferencia Recomendada', `Mueve dinero a Revolut para cubrir tus sobres.`, `Faltan ${revolutGap.toFixed(0)}€ en Revolut.`, 9);
    }

    // 5.5 Calidad de Descripciones
    const badDescriptions = currentMonthExpenses.filter(e => !e.description || e.description === 'Gasto' || e.description === 'Ingreso').length;
    if (badDescriptions > 5) {
        addInsight('neutral', '📝 Mejora tus Datos', `Tienes ${badDescriptions} gastos sin descripción clara.`, 'Añade detalles para que la IA sea más precisa.', 2);
    }

    // 5.6 Diversidad de Ingresos
    const incomeSources = new Set(currentMonthExpenses.filter(e => e.type === 'income').map(e => e.category)).size;
    if (incomeSources > 1) {
        addInsight('success', '🌱 Ingresos Diversificados', 'Tienes más de una fuente de ingresos.', 'La diversificación reduce el riesgo financiero.', 5);
    }

    // 5.7 Impuestos
    const taxKeywords = ['hacienda', 'aeat', 'impuesto', 'ibi', 'ivtm'];
    const taxSpend = currentMonthExpenses.filter(e => taxKeywords.some(k => e.description?.toLowerCase().includes(k))).reduce((s,e)=>s+e.amount,0);
    if (taxSpend > 0) {
        addInsight('info', '🏛️ Deber Ciudadano', `Has pagado ${taxSpend}€ en impuestos.`, 'Importante tenerlo previsto en el fondo de emergencia.', 3);
    }

    // 5.8 Salud y Bienestar
    const healthKeywords = ['farmacia', 'medico', 'dentista', 'salud', 'gimnasio', 'gym', 'deporte'];
    const healthSpend = currentMonthExpenses.filter(e => healthKeywords.some(k => e.description?.toLowerCase().includes(k))).reduce((s,e)=>s+e.amount,0);
    if (healthSpend > 0) {
        addInsight('success', '❤️ Inversión en Salud', `Has dedicado ${healthSpend}€ a cuidarte.`, 'La mejor inversión es tu propio cuerpo.', 4);
    } else if (totalSpent > 500) {
        addInsight('info', '🏃‍♂️ ¿Y la Salud?', 'No detecto gastos en salud o deporte.', 'Recuerda que prevenir es más barato que curar.', 2);
    }

    // 5.9 Mascotas
    const petKeywords = ['veterinario', 'mascota', 'perro', 'gato', 'pienso', 'kiwoko', 'zooplus'];
    const petSpend = currentMonthExpenses.filter(e => petKeywords.some(k => e.description?.toLowerCase().includes(k))).reduce((s,e)=>s+e.amount,0);
    if (petSpend > 0) {
        addInsight('info', '🐾 Gasto Peludo', `Tu mascota ha costado ${petSpend}€ este mes.`, 'Amor incondicional (con coste de mantenimiento).', 3);
    }

    // 5.10 Formación
    const eduKeywords = ['curso', 'udemy', 'platzi', 'libro', 'formacion', 'universidad', 'master'];
    const eduSpend = currentMonthExpenses.filter(e => eduKeywords.some(k => e.description?.toLowerCase().includes(k))).reduce((s,e)=>s+e.amount,0);
    if (eduSpend > 0) {
        addInsight('success', '🧠 Cerebro en Forma', `Has invertido ${eduSpend}€ en aprender.`, 'El conocimiento paga el mejor interés.', 6);
    }

    // ==========================================
    // 6. ANÁLISIS MATEMÁTICO Y ESTADÍSTICO (NUEVO)
    // ==========================================

    // 6.1 Volatilidad del Gasto (Desviación Estándar)
    if (currentDay > 2) {
        const dailySpends = Array(currentDay).fill(0);
        currentMonthExpenses.forEach(e => {
            if (e.type === 'expense') {
                const day = new Date(e.date).getDate() - 1;
                if (day >= 0 && day < currentDay) dailySpends[day] += e.amount;
            }
        });
        const mean = totalSpent / currentDay;
        const variance = dailySpends.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / currentDay;
        const stdDev = Math.sqrt(variance);
        
        if (stdDev > mean * 1.5) {
            addInsight('warning', '📊 Gasto Volátil', `Tu desviación estándar es alta (${stdDev.toFixed(0)}€).`, 'Tus gastos diarios son muy impredecibles.', 5);
        } else if (stdDev < mean * 0.5 && totalSpent > 0) {
            addInsight('success', '📏 Gasto Consistente', 'Tus gastos diarios son muy estables.', 'Facilita mucho la planificación.', 4);
        }
    }

    // 6.2 Tendencia Lineal (Regresión Simple)
    if (currentDay > 5) {
        // x = día, y = gasto acumulado hasta ese día
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        let cumulative = 0;
        const points = [];
        
        for (let i = 1; i <= currentDay; i++) {
            const daySpend = currentMonthExpenses.filter(e => new Date(e.date).getDate() === i && e.type === 'expense')
                .reduce((s, e) => s + e.amount, 0);
            cumulative += daySpend;
            points.push({ x: i, y: cumulative });
        }

        points.forEach(p => {
            sumX += p.x;
            sumY += p.y;
            sumXY += p.x * p.y;
            sumXX += p.x * p.x;
        });

        const n = points.length;
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX); // Pendiente (Gasto promedio diario ajustado)
        
        // Si la pendiente es mucho mayor que el promedio simple, indica aceleración reciente
        const simpleAvg = totalSpent / currentDay;
        if (slope > simpleAvg * 1.2) {
            addInsight('warning', '📈 Tendencia al Alza', 'Tu ritmo de gasto está acelerando.', 'Estás gastando más en los últimos días que al principio.', 6);
        }
    }

    // 6.3 Principio de Pareto (80/20)
    const sortedCategories = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    let accumulatedPercent = 0;
    let count = 0;
    for (const [cat, amount] of sortedCategories) {
        accumulatedPercent += (amount / totalSpent);
        count++;
        if (accumulatedPercent >= 0.8) break;
    }
    const categoryCount = Object.keys(catTotals).length;
    if (categoryCount > 4 && count <= Math.ceil(categoryCount * 0.2)) {
        addInsight('info', '📐 Principio de Pareto', `El 80% de tu gasto viene de solo ${count} categorías.`, 'Enfócate en optimizar esas pocas categorías.', 5);
    }

    // 6.4 Multiplicador de Fin de Semana
    if (totalSpent > 0) {
        const weekendDays = currentMonthExpenses.filter(e => {
            const d = new Date(e.date).getDay();
            return (d === 0 || d === 6) && e.type === 'expense';
        }).length > 0 ? 8 : 1; // Estimación simple de días
        const weekdayDays = Math.max(1, currentDay - (currentDay > 7 ? 2 : 0)); // Estimación muy burda, mejor usar lógica real si posible
        
        // Cálculo más preciso de promedios
        let weekendSum = 0, weekendCount = 0;
        let weekdaySum = 0, weekdayCount = 0;
        
        // Iterar por días del mes hasta hoy
        for (let i = 1; i <= currentDay; i++) {
            const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
            const daySpend = currentMonthExpenses.filter(e => new Date(e.date).getDate() === i && e.type === 'expense')
                .reduce((s, e) => s + e.amount, 0);
            
            if (d.getDay() === 0 || d.getDay() === 6) {
                weekendSum += daySpend;
                weekendCount++;
            } else {
                weekdaySum += daySpend;
                weekdayCount++;
            }
        }

        if (weekendCount > 0 && weekdayCount > 0) {
            const weekendAvg = weekendSum / weekendCount;
            const weekdayAvg = weekdaySum / weekdayCount;
            const multiplier = weekendAvg / (weekdayAvg || 1);

            if (multiplier > 2.5) {
                addInsight('info', '🎉 Efecto Fin de Semana', `Gastas ${multiplier.toFixed(1)}x más los fines de semana.`, 'El ocio concentra tu presupuesto.', 4);
            }
        }
    }

    // 6.5 Probabilidad de Día Cero
    if (currentDay > 5) {
        const daysWithSpend = new Set(currentMonthExpenses.filter(e => e.type === 'expense').map(e => new Date(e.date).getDate())).size;
        const zeroDays = currentDay - daysWithSpend;
        const zeroProb = (zeroDays / currentDay) * 100;
        
        if (zeroProb > 40) {
            addInsight('success', '🧘 Mente Estoica', `Tienes un ${zeroProb.toFixed(0)}% de probabilidad de no gastar nada hoy.`, 'Gran control de impulsos.', 5);
        }
    }

    // 6.6 Ratio de Necesidades Básicas
    if (totalIncome > 0) {
        const basicNeeds = ['Comidas', 'Transporte', 'Vivienda', 'Supermercado', 'Casa']; // Keywords o categorías
        const basicSpend = currentMonthExpenses.filter(e => 
            basicNeeds.includes(e.category) || 
            housingKeywords.some(k => e.description?.toLowerCase().includes(k)) ||
            transportKeywords.some(k => e.description?.toLowerCase().includes(k))
        ).reduce((s, e) => s + e.amount, 0);
        
        const needsRatio = (basicSpend / totalIncome) * 100;
        if (needsRatio < 50 && totalSpent > 0) {
            addInsight('success', '📉 Coste de Vida Bajo', `Tus necesidades básicas son solo el ${needsRatio.toFixed(0)}% de tus ingresos.`, 'Tienes mucho margen de maniobra.', 7);
        }
    }

    // 6.7 Proyección de Interés Compuesto
    if (accumulatedCushion > 1000) {
        const rate = 0.05; // 5% anual conservador
        const years = 10;
        const futureValue = accumulatedCushion * Math.pow(1 + rate, years);
        const gain = futureValue - accumulatedCushion;
        addInsight('action', '🌳 Semilla de Riqueza', `Si inviertes tu colchón al 5%, en 10 años tendrás ${(futureValue).toFixed(0)}€.`, `Ganancia pasiva: ${gain.toFixed(0)}€.`, 6);
    }

    // 6.8 Intensidad de Transacción
    const txCount = currentMonthExpenses.filter(e => e.type === 'expense').length;
    if (txCount > 0) {
        const avgTxSize = totalSpent / txCount;
        if (avgTxSize > 50) {
            addInsight('info', '🐘 Compras Grandes', `Tu ticket medio es alto (${avgTxSize.toFixed(0)}€).`, 'Haces pocas compras pero de valor.', 3);
        } else if (avgTxSize < 10) {
            addInsight('info', '🐁 Micro-consumo', `Tu ticket medio es bajo (${avgTxSize.toFixed(0)}€).`, 'Muchas compras pequeñas.', 3);
        }
    }

    // 6.9 Cobertura Real de Emergencia
    if (accumulatedCushion > 0 && currentDay > 5) {
        const dailyBurn = totalSpent / currentDay;
        if (dailyBurn > 0) {
            const daysCovered = accumulatedCushion / dailyBurn;
            if (daysCovered < 30) {
                addInsight('warning', '⏱️ Cuenta Atrás', `A este ritmo, tu dinero dura ${daysCovered.toFixed(0)} días.`, '¡Urgente reducir gastos!', 9);
            }
        }
    }

    // 6.10 Ratio de Endeudamiento (Detección)
    const debtKeywords = ['prestamo', 'préstamo', 'credito', 'crédito', 'hipoteca', 'plazo', 'financiacion'];
    const debtPayment = currentMonthExpenses.filter(e => debtKeywords.some(k => e.description?.toLowerCase().includes(k))).reduce((s,e)=>s+e.amount,0);
    if (totalIncome > 0 && debtPayment > 0) {
        const debtRatio = (debtPayment / totalIncome) * 100;
        if (debtRatio > 30) {
            addInsight('warning', '⛓️ Cadenas de Deuda', `Destinas el ${debtRatio.toFixed(0)}% a pagar deudas.`, 'Peligroso si suben los tipos o bajan ingresos.', 8);
        }
    }

    // 6.11 Puntuación de Salud Financiera (FICO Simulado)
    let healthScore = 50; // Base
    if (savingsRate > 20) healthScore += 20;
    else if (savingsRate > 10) healthScore += 10;
    else if (savingsRate < 0) healthScore -= 20;
    
    if (accumulatedCushion > totalSpent * 3) healthScore += 20;
    else if (accumulatedCushion < totalSpent) healthScore -= 10;
    
    if (debtPayment === 0) healthScore += 10;
    
    let scoreColor = 'neutral';
    if (healthScore >= 80) scoreColor = 'success';
    else if (healthScore < 40) scoreColor = 'warning';
    
    addInsight(scoreColor, '🏥 Score Financiero', `Puntuación: ${healthScore}/100`, 'Basado en ahorro, colchón y deuda.', 7);

    // 6.12 Días hasta la Quiebra (Si no hubiera ingresos)
    if (accumulatedCushion > 0 && totalSpent > 0) {
        const dailyAvg = totalSpent / currentDay;
        const daysToZero = accumulatedCushion / dailyAvg;
        if (daysToZero < 60) {
             // Ya cubierto por Runway, pero con otro enfoque
        } else {
            const years = (daysToZero / 365).toFixed(1);
            if (years > 1) {
                addInsight('success', '♾️ Pista de Despegue', `Podrías vivir ${years} años sin ingresos.`, 'Libertad real.', 8);
            }
        }
    }

    // 6.13 Inflación de Estilo de Vida
    // Requiere histórico, pero podemos simular con presupuesto vs gasto
    const budgetTotal = Object.values(financialProfile.monthlyBudgets?.[`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`] || financialProfile.budgets || {}).reduce((a, b) => a + b, 0);
    if (budgetTotal > 0 && totalSpent > budgetTotal * 1.2) {
        addInsight('warning', '🎈 Inflación de Estilo', 'Gastas un 20% más de lo presupuestado.', '¿Estás subiendo tu nivel de vida demasiado rápido?', 6);
    }

    // 6.14 Factor "Latte" Porcentual
    const smallSpends = currentMonthExpenses.filter(e => e.type === 'expense' && e.amount < 5).reduce((s,e)=>s+e.amount,0);
    if (totalSpent > 0 && (smallSpends / totalSpent) > 0.1) {
        addInsight('info', '☕ Efecto Hormiga', `El 10% de tu dinero se va en gastos < 5€.`, 'Pequeños agujeros hunden grandes barcos.', 4);
    }

    // 6.15 Velocidad de Ahorro (Euros por día)
    if (totalIncome > 0 && isCurrentMonth) {
        const savingsSoFar = totalIncome - totalSpent;
        const saveSpeed = savingsSoFar / currentDay;
        if (saveSpeed > 0) {
            addInsight('success', '🏎️ Velocidad de Ahorro', `Estás acumulando ${saveSpeed.toFixed(1)}€ netos cada día.`, '¡Sigue así!', 5);
        } else {
            addInsight('warning', '📉 Desangrado Diario', `Estás perdiendo ${Math.abs(saveSpeed).toFixed(1)}€ netos cada día.`, 'Frena el gasto.', 6);
        }
    }

    // Ordenar insights por importancia (score)
    const sortedInsights = insights.sort((a, b) => b.score - a.score);

    return (
        <div className="bg-black p-6 rounded-3xl border border-white/10 shadow-2xl mb-8">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <span className="bg-white/10 p-2 rounded-lg text-white">🧠</span> 
                Asistente Financiero IA 3.0
                <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded-full border border-blue-700 ml-auto">
                    {sortedInsights.length} Insights
                </span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                {sortedInsights.length > 0 ? sortedInsights.map((insight, idx) => (
                    <div key={idx} className={`p-5 rounded-2xl border flex flex-col gap-2 transition hover:scale-[1.02] duration-300 relative overflow-hidden ${
                        insight.type === 'action' ? 'bg-blue-900/20 border-blue-500/30 text-blue-200' :
                        insight.type === 'warning' ? 'bg-red-900/20 border-red-500/30 text-red-200' :
                        insight.type === 'success' ? 'bg-green-900/20 border-green-500/30 text-green-200' :
                        insight.type === 'info' ? 'bg-purple-900/10 border-purple-500/20 text-purple-200' :
                        'bg-neutral-900 border-white/10 text-gray-300'
                    }`}>
                        <div className="flex items-start justify-between z-10">
                            <h4 className="font-bold text-md leading-tight">{insight.title}</h4>
                            <span className="text-xl">
                                {insight.type === 'warning' && '⚠️'}
                                {insight.type === 'success' && '🚀'}
                                {insight.type === 'action' && '⚡'}
                                {insight.type === 'info' && '💡'}
                                {insight.type === 'neutral' && 'ℹ️'}
                            </span>
                        </div>
                        <p className="text-sm font-medium opacity-90 z-10">{insight.text}</p>
                        {insight.details && <p className="text-xs opacity-60 mt-auto pt-2 border-t border-white/5 z-10">{insight.details}</p>}
                        
                        {/* Background decoration */}
                        <div className={`absolute -right-4 -bottom-4 w-20 h-20 rounded-full blur-2xl opacity-10 z-0 ${
                             insight.type === 'warning' ? 'bg-red-500' :
                             insight.type === 'success' ? 'bg-green-500' :
                             insight.type === 'action' ? 'bg-blue-500' : 'bg-gray-500'
                        }`}></div>
                    </div>
                )) : (
                    <div className="col-span-3 p-12 text-center text-gray-500 border border-white/5 rounded-2xl bg-neutral-900/50">
                        <p className="text-lg">🤖 Recopilando datos...</p>
                        <p className="text-sm mt-2">Añade más gastos para que la IA pueda detectar patrones complejos.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SmartInsights;