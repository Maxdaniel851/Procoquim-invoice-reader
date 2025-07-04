function updateStepStatus(step, completed) {
    const stepElement = document.getElementById(`step${step}`);
    const circle = stepElement.querySelector('div');
    const dot = stepElement.querySelector('.w-2');
    
    if (completed) {
        stepElement.className = 'progress-step completed flex flex-col items-center';
        circle.className = 'w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold bg-gradient-to-br from-green-400 to-green-600 text-white transition-all duration-500 transform scale-110';
        stepElement.querySelector('span').className = 'mt-3 text-sm font-medium text-green-600';
        dot.className = 'mt-1 w-2 h-2 rounded-full bg-green-500 transition-all duration-500';
        
        // Añadir efecto de éxito
        circle.style.animation = 'checkmark 0.6s ease-in-out';
    }
}

// ========================================
// FUNCIONES DE DRAG AND DROP
// ========================================

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const event = { target: { files: [files[0]] } };
        handleFileUpload(event);
    }
}

function handleExcelDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const event = { target: { files: [files[0]] } };
        handleExcelUpload(event);
    }
}

// ========================================
// FUNCIONES DE PROCESAMIENTO DE PRODUCTOS
// ========================================

function isPackagingItem(productName) {
    const packagingKeywords = ['TAMBOR', 'TANQUE', 'BIDÓN', 'BALDE', 'CANECA', 'ENVASE', 'RECIPIENTE', 'GALÓN', 'PIMPINA', 'IBC', 'CONTENEDOR'];
    const normalizedName = productName.toUpperCase();
    return packagingKeywords.some(keyword => normalizedName.includes(keyword));
}

function normalizeProductName(productName) {
    const normalized = productName.toUpperCase().trim();
    if (productMapping[normalized]) {
        return productMapping[normalized];
    }
    for (const [key, value] of Object.entries(productMapping)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return value;
        }
    }
    return productName;
}

function extractBaseName(productName) {
    let baseName = productName.toUpperCase().trim();
    
    const presentationPatterns = [
        /\s*X\s*\d+(\.\d+)?\s*(KG|KILOGRAMO|KILOGRAMOS|G|GRAMO|GRAMOS|L|LITRO|LITROS|ML|MILILITRO|MILILITROS|GAL|GALÓN|GALONES)/gi,
        /\s*X\s*\d+\/\d+\s*(KG|KILOGRAMO|KILOGRAMOS|G|GRAMO|GRAMOS|L|LITRO|LITROS|ML|MILILITRO|MILILITROS)/gi,
        /\s*\d+(\.\d+)?\s*(KG|KILOGRAMO|KILOGRAMOS|G|GRAMO|GRAMOS|L|LITRO|LITROS|ML|MILILITRO|MILILITROS|GAL|GALÓN|GALONES)$/gi
    ];
    
    presentationPatterns.forEach(pattern => {
        baseName = baseName.replace(pattern, '');
    });
    
    baseName = baseName.replace(/\s+/g, ' ').trim();
    baseName = baseName.replace(/[-\s]*$/, '');
    
    return baseName;
}

function normalizeForComparison(name) {
    let normalized = extractBaseName(name);
    const commonWords = ['TECNICO', 'TEC', 'IND', 'INDUSTRIAL', 'USP', 'CONCENTRADA', 'CONCENTRADO', 'AL', 'DE', 'EN', 'POLVO'];
    commonWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        normalized = normalized.replace(regex, '');
    });
    return normalized.replace(/\s+/g, ' ').trim();
}

function formatCurrency(value) {
    return value ? new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP' 
    }).format(value) : 'N/A';
}

// ========================================
// PROCESAMIENTO DE PDF
// ========================================

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }

    return fullText;
}

// ========================================
// PARSEO DE FACTURA
// ========================================

function parseInvoiceText(text) {
    try {
        const invoiceNumberMatch = text.match(/No\.\s*PCQP\s*(\d+)/);
        const invoiceNumber = invoiceNumberMatch ? invoiceNumberMatch[1] : null;

        const generationDateMatch = text.match(/Generación\s*(\d{2}\/\d{2}\/\d{4})/);
        const expeditionDateMatch = text.match(/Expedición\s*(\d{2}\/\d{2}\/\d{4})/);
        const dueDateMatch = text.match(/Vencimiento\s*(\d{2}\/\d{2}\/\d{4})/);

        const customerMatch = text.match(/Señores\s*([A-ZÁÉÍÓÚÑ\s]+)/);
        const nitMatch = text.match(/NIT\s*([\d\.-]+)/);

        const totalBrutoMatch = text.match(/Total Bruto\s*([\d,]+\.?\d*)/);
        const ivaMatch = text.match(/IVA 19%\s*([\d,]+\.?\d*)/);
        const totalPagarMatch = text.match(/Total a Pagar\s*([\d,]+\.?\d*)/);

        const products = [];
        const productRegex = /(\d+)\s+([A-ZÁÉÍÓÚÑ\s\-\d%.X]+?)\s+(Kilogramo|Kilogramos|Litro|LITROS|kilogramo|Unidad)\s+(\d+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+\d+\s*%\s+([\d,]+\.?\d*)/gm;
        
        let match;
        while ((match = productRegex.exec(text)) !== null) {
            const originalProductName = match[2].trim();
            const normalizedProductName = normalizeProductName(originalProductName);
            const isPackaging = isPackagingItem(originalProductName);
            const isHypochloriteCorrected = originalProductName.includes('HIPOCLORITO DE SODIO AL 15%');
            
            products.push({
                item: match[1],
                descripcionOriginal: originalProductName,
                descripcionNormalizada: normalizedProductName,
                unidad: match[3],
                cantidad: parseFloat(match[4]),
                valorUnitario: parseFloat(match[5].replace(/,/g, '')),
                valorBruto: parseFloat(match[6].replace(/,/g, '')),
                valorTotal: parseFloat(match[7].replace(/,/g, '')),
                esEnvase: isPackaging,
                errorEscritura: isHypochloriteCorrected
            });
        }

        return {
            proveedor: "PROCOQUIM S.A.S",
            numeroFactura: invoiceNumber,
            fechaGeneracion: generationDateMatch ? generationDateMatch[1] : null,
            fechaExpedicion: expeditionDateMatch ? expeditionDateMatch[1] : null,
            fechaVencimiento: dueDateMatch ? dueDateMatch[1] : null,
            cliente: {
                nombre: customerMatch ? customerMatch[1].trim() : null,
                nit: nitMatch ? nitMatch[1] : null
            },
            productos: products,
            totales: {
                bruto: totalBrutoMatch ? parseFloat(totalBrutoMatch[1].replace(/,/g, '')) : null,
                iva: ivaMatch ? parseFloat(ivaMatch[1].replace(/,/g, '')) : null,
                total: totalPagarMatch ? parseFloat(totalPagarMatch[1].replace(/,/g, '')) : null
            },
            totalProductos: products.length
        };
    } catch (err) {
        throw new Error(`Error parsing invoice: ${err.message}`);
    }
}

// ========================================
// MANEJADORES DE ARCHIVOS
// ========================================

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading();
    hideError();

    try {
        let text = '';
        
        if (file.type === 'application/pdf') {
            text = await extractTextFromPDF(file);
        } else if (file.type === 'text/plain') {
            text = await file.text();
        } else {
            throw new Error('Tipo de archivo no soportado. Solo se aceptan archivos PDF y TXT.');
        }

        if (text.trim().length < 50) {
            throw new Error('El archivo parece estar vacío o no contiene suficiente texto.');
        }

        const parsedData = parseInvoiceText(text);
        invoiceData = parsedData;
        
        updateStepStatus(1, true);
        document.getElementById('invoiceStatus').classList.remove('hidden');
        displayInvoiceDetails();
        checkUpdateButton();
        showNotification('¡Factura procesada exitosamente! 🎉');
        
    } catch (err) {
        showError(err.message);
    } finally {
        hideLoading();
    }
}

function handleTextPaste(event) {
    const text = event.target.value;
    if (text.trim().length > 100) {
        try {
            const parsedData = parseInvoiceText(text);
            invoiceData = parsedData;
            
            updateStepStatus(1, true);
            document.getElementById('invoiceStatus').classList.remove('hidden');
            displayInvoiceDetails();
            checkUpdateButton();
            hideError();
            showNotification('¡Texto de factura procesado! 📄');
        } catch (err) {
            showError(err.message);
        }
    }
}

async function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading();
    hideError();

    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, {
            cellStyles: true,
            cellFormulas: true,
            cellDates: true
        });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        excelData = {
            workbook,
            worksheet,
            data: jsonData,
            sheetName: firstSheetName
        };

        updateStepStatus(2, true);
        document.getElementById('excelStatus').classList.remove('hidden');
        checkUpdateButton();
        showNotification('¡Excel cargado correctamente! 📊');

    } catch (err) {
        showError('Error al leer el archivo Excel: ' + err.message);
    } finally {
        hideLoading();
    }
}

// ========================================
// LÓGICA DE COINCIDENCIAS
// ========================================

function findMatches(invoiceProducts, excelProducts) {
    const matches = [];
    const unmatched = [];

    invoiceProducts.forEach(invoiceProduct => {
        if (invoiceProduct.esEnvase) return;

        let bestMatch = null;
        let bestScore = 0;

        excelProducts.forEach(excelProduct => {
            const excelName = excelProduct['🛍️ PRODUCTOS'] || '';
            const excelBaseName = normalizeForComparison(excelName);
            const invoiceBaseName = normalizeForComparison(invoiceProduct.descripcionNormalizada);
            
            let score = 0;
            
            if (excelBaseName === invoiceBaseName) {
                score = 100;
            } else if (excelBaseName.includes(invoiceBaseName) || invoiceBaseName.includes(excelBaseName)) {
                score = 95;
            } else {
                const excelWords = excelBaseName.split(/\s+/).filter(word => word.length > 2);
                const invoiceWords = invoiceBaseName.split(/\s+/).filter(word => word.length > 2);
                
                if (excelWords.length > 0 && invoiceWords.length > 0) {
                    const commonWords = excelWords.filter(excelWord => 
                        invoiceWords.some(invoiceWord => 
                            excelWord.includes(invoiceWord) || invoiceWord.includes(excelWord)
                        )
                    );
                    score = (commonWords.length / Math.max(excelWords.length, invoiceWords.length)) * 90;
                }
            }

            if (score > bestScore && score > 75) {
                bestScore = score;
                bestMatch = {
                    excelProduct,
                    excelName,
                    excelBaseName,
                    invoiceBaseName,
                    score
                };
            }
        });

        if (bestMatch) {
            matches.push({
                invoiceProduct,
                excelMatch: bestMatch,
                priceChange: {
                    oldPrice: bestMatch.excelProduct['💰 PRECIO BASE'] || 0,
                    newPrice: invoiceProduct.valorUnitario,
                    difference: invoiceProduct.valorUnitario - (bestMatch.excelProduct['💰 PRECIO BASE'] || 0)
                }
            });
        } else {
            unmatched.push(invoiceProduct);
        }
    });

    return { matches, unmatched };
}

// ========================================
// FUNCIONES PRINCIPALES
// ========================================

function checkUpdateButton() {
    if (invoiceData && excelData && !updateResults) {
        document.getElementById('updateSection').style.display = 'block';
        // Scroll suave al botón
        setTimeout(() => {
            document.getElementById('updateSection').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
        }, 300);
    }
}

function updateExcelPrices() {
    if (!invoiceData || !excelData) return;

    showLoading();

    try {
        const chemicalProducts = invoiceData.productos.filter(p => !p.esEnvase);
        const { matches, unmatched } = findMatches(chemicalProducts, excelData.data);

        const newWorkbook = { ...excelData.workbook };
        const newWorksheet = { ...excelData.worksheet };

        matches.forEach(match => {
            const excelRowIndex = excelData.data.findIndex(row => 
                row['🛍️ PRODUCTOS'] === match.excelMatch.excelName
            ) + 2;

            const cellAddress = `B${excelRowIndex}`;
            if (!newWorksheet[cellAddress]) {
                newWorksheet[cellAddress] = {};
            }
            newWorksheet[cellAddress].v = match.invoiceProduct.valorUnitario;
            newWorksheet[cellAddress].t = 'n';
        });

        updateResults = {
            matches,
            unmatched,
            updatedWorkbook: newWorkbook,
            updatedWorksheet: newWorksheet
        };

        updateStepStatus(3, true);
        displayResults();
        document.getElementById('floatingAction').style.display = 'block';
        showNotification('¡Precios actualizados exitosamente! 🚀');

    } catch (err) {
        showError('Error al actualizar precios: ' + err.message);
    } finally {
        hideLoading();
    }
}

function downloadUpdatedExcel() {
    if (!updateResults) return;

    try {
        const wb = updateResults.updatedWorkbook;
        wb.Sheets[excelData.sheetName] = updateResults.updatedWorksheet;
        
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Inventario_Actualizado_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('¡Archivo descargado exitosamente! 📥');
    } catch (err) {
        showError('Error al generar el archivo Excel: ' + err.message);
    }
}

// ========================================
// FUNCIONES DE DISPLAY
// ========================================

function displayInvoiceDetails() {
    if (!invoiceData) return;

    const chemicalProducts = invoiceData.productos.filter(p => !p.esEnvase);
    const packagingProducts = invoiceData.productos.filter(p => p.esEnvase);
    const errorProducts = invoiceData.productos.filter(p => p.errorEscritura);

    const html = `
        <div class="space-y-8 fade-in">
            <div class="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-3xl shadow-2xl overflow-hidden">
                <div class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8">
                    <h2 class="text-3xl font-bold mb-2 flex items-center">
                        <span class="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center mr-4">✅</span>
                        Factura Procesada Exitosamente
                    </h2>
                    <p class="text-blue-100">Todos los datos han sido extraídos y organizados automáticamente</p>
                </div>

                <div class="p-8 space-y-6">
                    <!-- Información general con diseño de tarjetas -->
                    <div class="bg-white rounded-2xl shadow-lg p-6">
                        <h3 class="text-xl font-bold mb-6 text-gray-800 flex items-center">
                            <span class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">📋</span>
                            Información General
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div class="stat-card p-6">
                                <div class="flex items-center mb-2">
                                    <span class="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center mr-3 text-sm">📄</span>
                                    <label class="text-sm font-semibold text-gray-600">Número de Factura</label>
                                </div>
                                <p class="text-xl font-bold text-blue-600">PCQP ${invoiceData.numeroFactura || 'N/A'}</p>
                            </div>
                            <div class="stat-card p-6">
                                <div class="flex items-center mb-2">
                                    <span class="w-8 h-8 bg-green-500 text-white rounded-lg flex items-center justify-center mr-3 text-sm">📅</span>
                                    <label class="text-sm font-semibold text-gray-600">Fecha de Generación</label>
                                </div>
                                <p class="text-xl font-bold text-green-600">${invoiceData.fechaGeneracion || 'N/A'}</p>
                            </div>
                            <div class="stat-card p-6">
                                <div class="flex items-center mb-2">
                                    <span class="w-8 h-8 bg-purple-500 text-white rounded-lg flex items-center justify-center mr-3 text-sm">🏢</span>
                                    <label class="text-sm font-semibold text-gray-600">Cliente</label>
                                </div>
                                <p class="text-lg font-bold text-purple-600">${invoiceData.cliente.nombre || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Resumen de productos con estadísticas visuales -->
                    <div class="bg-white rounded-2xl shadow-lg p-6">
                        <h3 class="text-xl font-bold mb-6 text-gray-800 flex items-center">
                            <span class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">📊</span>
                            Resumen de Productos
                        </h3>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div class="text-center stat-card p-6">
                                <div class="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto mb-4">
                                    📦
                                </div>
                                <div class="text-3xl font-bold text-blue-600 mb-2">${invoiceData.totalProductos}</div>
                                <div class="text-sm font-medium text-gray-600">Total productos</div>
                            </div>
                            <div class="text-center stat-card p-6">
                                <div class="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto mb-4">
                                    🧪
                                </div>
                                <div class="text-3xl font-bold text-green-600 mb-2">${chemicalProducts.length}</div>
                                <div class="text-sm font-medium text-gray-600">Productos químicos</div>
                            </div>
                            <div class="text-center stat-card p-6">
                                <div class="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto mb-4">
                                    📦
                                </div>
                                <div class="text-3xl font-bold text-purple-600 mb-2">${packagingProducts.length}</div>
                                <div class="text-sm font-medium text-gray-600">Items de envase</div>
                            </div>
                            <div class="text-center stat-card p-6">
                                <div class="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto mb-4">
                                    ⚠️
                                </div>
                                <div class="text-3xl font-bold text-orange-600 mb-2">${errorProducts.length}</div>
                                <div class="text-sm font-medium text-gray-600">Errores corregidos</div>
                            </div>
                        </div>
                    </div>

                    <!-- Tabla de productos químicos mejorada -->
                    <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
                        <div class="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-6">
                            <h3 class="text-xl font-bold flex items-center">
                                <span class="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-3">🧪</span>
                                Productos Químicos para Inventario (${chemicalProducts.length})
                            </h3>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="min-w-full">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Item</th>
                                        <th class="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Producto</th>
                                        <th class="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Cantidad</th>
                                        <th class="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Valor Unitario</th>
                                        <th class="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Total</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-200">
                                    ${chemicalProducts.map((producto, index) => `
                                        <tr class="table-row-hover ${producto.errorEscritura ? 'bg-orange-50' : ''}">
                                            <td class="px-6 py-4 whitespace-nowrap">
                                                <div class="flex items-center">
                                                    <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-sm mr-3">
                                                        ${producto.item}
                                                    </div>
                                                    ${producto.errorEscritura ? '<span class="px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded-full font-semibold">Corregido ✓</span>' : ''}
                                                </div>
                                            </td>
                                            <td class="px-6 py-4">
                                                <div class="space-y-1">
                                                    <div class="font-semibold text-gray-900">${producto.descripcionOriginal}</div>
                                                    <div class="text-sm text-blue-600 bg-blue-50 rounded-lg px-3 py-1 inline-block">
                                                        ${producto.descripcionNormalizada}
                                                    </div>
                                                </div>
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap">
                                                <span class="px-3 py-2 bg-gray-100 rounded-lg font-semibold text-gray-800">
                                                    ${producto.cantidad} ${producto.unidad}
                                                </span>
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap">
                                                <span class="text-lg font-bold text-green-600">
                                                    ${formatCurrency(producto.valorUnitario)}
                                                </span>
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap">
                                                <span class="text-lg font-bold text-blue-600">
                                                    ${formatCurrency(producto.valorTotal)}
                                                </span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    ${packagingProducts.length > 0 ? `
                    <!-- Items de envase con diseño mejorado -->
                    <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
                        <div class="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6">
                            <h3 class="text-xl font-bold flex items-center">
                                <span class="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-3">📦</span>
                                Items de Envase (${packagingProducts.length})
                            </h3>
                            <p class="text-purple-100 mt-2">Estos items no afectarán el inventario químico</p>
                        </div>
                        <div class="p-6">
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                ${packagingProducts.map((producto, index) => `
                                    <div class="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4 card-hover">
                                        <div class="flex items-start space-x-3">
                                            <div class="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center text-white font-bold">
                                                📦
                                            </div>
                                            <div class="flex-1">
                                                <div class="font-semibold text-gray-900 mb-1">${producto.descripcionOriginal}</div>
                                                <div class="text-sm text-gray-600 mb-2">
                                                    ${producto.cantidad} ${producto.unidad}
                                                </div>
                                                <div class="text-lg font-bold text-purple-600">
                                                    ${formatCurrency(producto.valorUnitario)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    ` : ''}// ========================================
// CONFIGURACIÓN INICIAL
// ========================================

// Configurar PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Variables globales para almacenar datos
let invoiceData = null;
let excelData = null;
let updateResults = null;

// ========================================
// MAPEO DE PRODUCTOS
// ========================================

const productMapping = {
    'ACIDO ACETICO': 'ACIDO ACETICO TECNICO',
    'ACIDO NITRICO': 'ACIDO NITRICO',
    'ACIDO SULFONICO': 'ACIDO SULFONICO',
    'ACIDO OXALICO': 'ACIDO OXALICO',
    'ACIDO CITRICO': 'ACIDO CITRICO',
    'ALCOHOL CETILICO': 'CETOL C 16 - ALCOHOL CETILICO',
    'CETOL C 16': 'CETOL C 16 - ALCOHOL CETILICO',
    'ALCOHOL ETILICO': 'ALCOHOL ETANOL IND.',
    'ALCOHOL DESODORIZADO': 'ALCOHOL ETANOL IND.',
    'ALCOHOL PROPANOL': 'ALCOHOL PROPANOL',
    'VARSOL': 'VARSOL',
    'BETAINA': 'BETAINA',
    'COCOAMIDA': 'COCOAMIDA',
    'DODIGEN': 'DODIGEN',
    'GENAPOL': 'LESS AL 70% - LAURIL ÉTER SULFATO DE SODIO',
    'LESS AL 70%': 'LESS AL 70% - LAURIL ÉTER SULFATO DE SODIO',
    'NONIL': 'TERGICOL - NONIL',
    'BUTIL GLICOL': 'MONOBUTIL ETER - BUTIL GLICOL',
    'FORMOL': 'FORMOL',
    'GLICERINA': 'GLICERINA',
    'BICARBONATO DE SODIO': 'BICARBONATO DE SODIO USP',
    'BICARBONATO DE SODIO USP': 'BICARBONATO DE SODIO USP',
    'BISULFITO DE SODIO': 'BISULFITO EN POLVO',
    'SODA': 'SODA CAUSTICA',
    'SODA CAUSTICA': 'SODA CAUSTICA',
    'TPF': 'TRIPOLIFOSFATO',
    'TRIPOLIFOSFATO': 'TRIPOLIFOSFATO',
    'SILICONA EMULSION': 'SILICONA EMULSION',
    'CREOLINA': 'CREOLINA CONCENTRADA',
    'HIPOCLORITO DE SODIO': 'HIPOCLORITO DE SODIO AL 13%',
    'HIPOCLORITO DE SODIO AL 13%': 'HIPOCLORITO DE SODIO AL 13%',
    'HIPOCLORITO DE SODIO AL 15%': 'HIPOCLORITO DE SODIO AL 13%',
    'PROCIDE': 'PROCIDE 1.5',
    'PROCIDE 1.5': 'PROCIDE 1.5',
    'RINSOL': 'RINSOL',
    'SUAVIZANTE': 'SENSASOFT - SUAVIZANTE ENCAPSULADO BRISA FRESCA',
    'SENSASOFT': 'SENSASOFT - SUAVIZANTE ENCAPSULADO BRISA FRESCA',
    'SENSACLEAN': 'SENSACLEAN - DETERGENTE LIQUIDO',
    'SENSABLEACH': 'SENSABLEACH - BLANQUEADOR OXIGENADO'
};

// ========================================
// INICIALIZACIÓN
// ========================================

// Intersection Observer para animaciones
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

// Observar elementos con animación al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.section-fade').forEach(el => {
        observer.observe(el);
    });
});

// ========================================
// FUNCIONES DE UTILIDAD PARA UI
// ========================================

function showLoading() {
    document.getElementById('loading').style.display = 'flex';
    simulateProgress();
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function simulateProgress() {
    const progressBar = document.querySelector('.progress-bar');
    let width = 0;
    const interval = setInterval(() => {
        width += Math.random() * 15;
        if (width >= 100) {
            width = 100;
            clearInterval(interval);
        }
        progressBar.style.width = width + '%';
    }, 200);
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('error').style.display = 'block';
    // Auto-hide después de 10 segundos
    setTimeout(() => {
        hideError();
    }, 10000);
}

function hideError() {
    document.getElementById('error').style.display = 'none';
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification p-4 rounded-xl shadow-lg ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white font-semibold`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function updateStepStatus(step, completed) {
    const stepElement = document.getElementById(`step${step}`);
    const circle = stepElement.querySelector('div');
    const dot = stepElement.querySelector('.w-2');
    
    if (completed) {
        stepElement.className = 'progress-step completed flex flex-col items-center';
        circle.className = 'w-16 