String.prototype.hashCode = function(){
    var hash = 0;
      for (var i = 0; i < this.length; i++) {
          var char = this.charCodeAt(i);
          hash = ((hash<<5)-hash)+char;
          hash = hash & hash; // Convert to 32bit integer
      }
      return hash;
}
// Richiesta ricetta
async function axiosRecipe(recipe){
    let res = await axios({
        method: 'GET',
        url: 'http://host.docker.internal:8888/recipe?recipe=' + recipe,
    })
    if(res.status == 200) {
        return res.data
    } else return null
}
async function axiosGetSingleRecipe(selfUrl, recipeLabel){
    let res = await axios({
        method: 'GET', 
        url: 'http://host.docker.internal:8888/singleRecipe?selfUrl=' + selfUrl + '&recipeLabel=' + recipeLabel,
    })
    if(res.status == 200) {
        return res.data
    } else return null
}
async function axiosIngList(ing){
    let res = await axios({
        method : 'GET',
        url : 'http://host.docker.internal:8888/ingredients?ing=' + ing, 
    })
    if(res) return res.data;
    else return null;
}
async function axiosGetSingleIng(ing){
    let res = await axios({
        method: 'GET',
        url: 'http://host.docker.internal:8888/singleIng?ing=' + ing,
    })
    if(res.status == 200){
        return res.data;
    } else return null;
}
async function axiosAddEventCalendar(recipeIngList){
    let res = await axios({
        method: "POST",
        url: "http://host.docker.internal:8888/calendar",
        data: {
            list : recipeIngList,
        },
    })
    if(res) return res.data;
    else return null;
}

$(document).ready(()=> {
    let countRecipe = 0;
    let countIng = 0;
    let imgRecipe = [];
    let imgIng = [];

    // Buttons ricerca ricette e ingredienti
    $('#recipeBtn').click(e => {
        e.preventDefault();

        let recipe = $('#recipeBox').val();
        // console.log(recipe);
        if(recipe){
            // Richiesta ricette in base a ingrediente inserito e print di tutti i nomi delle ricette matchate
            axiosRecipe(recipe).then(data => {
                
                let lista = $('#recipeListDiv');
                // console.log(data.length);

                for(i=0; i < data.length; i++){
                    imgRecipe[i] = data[i].recipe.images.SMALL.url;
                    // Link ricetta
                    if(!$('#aRecipe' + i + 'ing').length){
                        aRecipe = $('<a/>')
                        .attr('class', 'list-group-item list-group-item-action aRec')
                        .attr('nrecipe', i)
                        .attr('id', 'aRecipe' + i + 'recipe')
                        .attr('data-bs-toggle', 'collapse')
                        .attr('aria-expanded', 'false')
                        .attr('reflink', data[i]._links.self.href)
                        .attr('role', 'button')
                        .attr('href', '#divDrop' + i + 'recipe')
                        .text(data[i].recipe.label)
                        .appendTo(lista);
                    }
                    // Collapse Div che contiene il Div che contiene Ingredienti e Valori Nut. della ricetta
                    if(!$('#divDrop' + i + 'recipe').length){
                        dropDiv = $('<div/>')
                        .attr('class', 'collapse')
                        .attr('id', 'divDrop' + i + 'recipe')
                        .appendTo(lista);
                    }
    
                    // Div che contiene Ingredienti e Val Nut. della ricetta
                    if(!$('#divValNutIng' + i + 'recipe').length){
                        dropDiv = $('<div/>')
                        .attr('class', 'container row p-2')
                        .attr('id', 'divValNutIng' + i + 'recipe')
                        .appendTo('#divDrop' + i + 'recipe');
                    }
                    // Div che contiene Val Nut. della ricetta
                    if(!$('#divValNut' + i + 'recipe').length){
                        divValNut = $('<div/>')
                        .attr('id', 'divValNut' + i + 'recipe')
                        .attr('class', 'col border border-success border-top-0 border-start-0 border-bottom-0 border-end-1 p-1')
                        .appendTo('#divValNutIng' + i + 'recipe');
                    }
                    // Div che contiene gli ingredienti della ricetta
                    if(!$('#divIng' + i + 'recipe').length){
                        divIng = $('<div/>')
                        .attr('id', 'divIng' + i + 'recipe')
                        .attr('class', 'col border border-success border-top-0 border-start-1 border-bottom-0 border-end-0 p-1')
                        .appendTo('#divValNutIng' + i + 'recipe');
                    }
                    // Tabella valori nutrizionali
                    if(!$('#tableValNut' + i + 'recipe').length){
                        nutTab = $('<table/>')
                        .attr('id','tableValNut' + i + 'recipe')
                        .attr('class', 'table')
                        .appendTo('#divValNut' + i + 'recipe');
                    }
                    
                    $('<thead/>').attr('id','tableHeadValNut' + i + 'recipe').appendTo('#tableValNut' + i + 'recipe');
                    $('<tr/>').attr('id','trHeadValNut' + i + 'recipe').appendTo('#tableHeadValNut' + i + 'recipe');
                    $('<th/>').attr('scope', 'col').text('Valore Nut.').appendTo('#trHeadValNut' + i + 'recipe');
                    $('<th/>').attr('scope', 'col').text('Quant.').appendTo('#trHeadValNut' + i + 'recipe');
                    $('<th/>').attr('scope', 'col').text('%').appendTo('#trHeadValNut' + i + 'recipe');
                    $('<tbody/>').attr('id','tableBodyValNut' + i + 'recipe').appendTo('#tableValNut' + i + 'recipe');
    
                    servings = data[i].recipe.yield;
                    valNut = data[i].recipe.totalNutrients;
                    daily = data[i].recipe.totalDaily;
    
                    keys = ['ENERC_KCAL', 'FAT', 'CHOCDF', 'FIBTG', 'PROCNT', 'CHOLE', 'NA', 'SUGAR'];
                    keysDaily = ['ENERC_KCAL', 'FAT', 'CHOCDF', 'FIBTG', 'PROCNT', 'CHOLE', 'NA'];
                    filNutrients = keys.map(key => valNut[key]).filter(v => v);
                    filNutrientsDaily = keysDaily.map(key => daily[key]).filter(v => v);
                    // console.log(filNutrients[0].label);
    
                    for(h=0; h<filNutrients.length; h++){
                        // Divido i valori per numero di persone della ricetta
                        if(h<4){
                            quant = filNutrients[h].quantity / servings; 
                            dailyQuant = filNutrientsDaily[h].quantity / servings;
                        } 
    
                        $('<tr/>').attr('id','trHeadValNut' + i + 'recipe' + h).appendTo('#tableBodyValNut' + i + 'recipe');
                        $('<td/>').attr('scope', 'row').text(filNutrients[h].label).appendTo('#trHeadValNut' + i + 'recipe' + h);
                        $('<td/>').text(Math.round(quant) + ' ' + filNutrients[h].unit).appendTo('#trHeadValNut' + i + 'recipe' + h);
                        if(filNutrientsDaily[h]) $('<td/>').text(Math.round(dailyQuant)).appendTo('#trHeadValNut' + i + 'recipe' + h);
                    }
    
                    if(!$('#ULIngredienti' + i + 'recipe').length){
                        ulIng = $('<ul/>')
                        .attr('class','list-group')
                        .attr('id', 'ULIngredienti' + i + 'recipe')
                        .appendTo('#divIng' + i + 'recipe');
                    }
    
                    let ing = data[i].recipe.ingredients;
                    // Crea Li ingrediente con nome e checkbox
                    for(j=0; j<ing.length; j++){
                        if(!$('#liIngrediente' + i + 'recipe' + '' + j).length){
                            liIng = $('<li/>')
                            .attr('class', 'list-group-item d-flex')
                            .attr('id', 'liIngrediente' + i + 'recipe' + '' + j)
                            .appendTo('#ULIngredienti' + i + 'recipe');
                        }
    
                        if(!$('#divIng' + i + 'recipe' + '' + j).length){
                            divSpIng = $('<div/>')
                            .attr('id', 'divIng' + i + 'recipe' + '' + j)
                            .attr('class', 'flex-fill')
                            .text(ing[j].food)
                            .appendTo('#liIngrediente' + i + 'recipe' + '' + j)
                        }
                        if(!$('#inputRecipeIngCheckBox' + i + 'recipe' + '' + j).length){
                            checkboxIng = $('<input/>')
                            .attr('class', 'form-check-input me-1 checkboxIng')
                            .attr('id', 'inputRecipeIngCheckBox' + i + 'recipe' + '' + j)
                            .attr('type', 'checkbox')
                            .appendTo('#liIngrediente' + i + 'recipe' + '' + j)
                        }
                    }
                }
            });
        }
    })
    $('#ingBtn').click(e => {
        e.preventDefault();

        let ing = $('#ingBox').val();
        console.log(ing);
        if(ing){
            $('#titleIngListModal').html(ing);

            axiosIngList(ing).then(data => {
                let lista = $('#IngListDiv');

                for(i=0; i < data.length; i++){
                    imgIng[i] = data[i].food.image;

                    if(!$('#aIng' + i + 'ing').length){
                        aIng = $('<a/>')
                        .attr('class', 'list-group-item list-group-item-action aRec flex-fill')
                        .attr('nIng', i)
                        .attr('id', 'aIng' + i + 'ing')
                        .attr('data-bs-toggle', 'collapse')
                        .attr('aria-expanded', 'false')
                        .attr('role', 'button')
                        .attr('href', '#divDrop' + i + 'ing')
                        .text(data[i].food.label)
                        .appendTo(lista);

                    }
                    // Collapse Div che contiene il Div che contiene Ingredienti e Valori Nut. della ricetta
                    if(!$('#divDrop' + i + 'ing').length){
                        dropDiv = $('<div/>')
                        .attr('class', 'collapse mt-2')
                        .attr('id', 'divDrop' + i + 'ing')
                        .appendTo(lista);
                    }
                    // Div che contiene immagine ingrediente
                    if(!$('#divImg' + i + 'ing').length){
                        dropDiv = $('<div/>')
                        .attr('id', 'divImg' + i + 'ing')
                        .appendTo('#divDrop' + i + 'ing');

                        $('<img>').attr('src', data[i].food.image).attr('class', 'card-img-top cardImg').appendTo('#divImg' + i + 'ing');
                    }

                    // Div che contiene Ingredienti e Val Nut. della ricetta
                    if(!$('#divValNutIng' + i + 'ing').length){
                        dropDiv = $('<div/>')
                        .attr('class', 'p-2')
                        .attr('id', 'divValNutIng' + i + 'ing')
                        .appendTo('#divDrop' + i + 'ing');
                    }
                    // // Div che contiene Val Nut. della ricetta
                    // if(!$('#divValNut' + i + 'ing').length){
                    //     divValNut = $('<div/>')
                    //     .attr('id', 'divValNut' + i + 'ing')
                    //     .attr('class', 'col border border-success border-top-0 border-start-0 border-bottom-0 border-end-1 p-1')
                    //     .appendTo('#divValNutIng' + i + 'ing');
                    // }
                    // // Div che contiene gli ingredienti della ricetta
                    // if(!$('#divIng' + i + 'ing').length){
                    //     divIng = $('<div/>')
                    //     .attr('id', 'divIng' + i + 'ing')
                    //     .attr('class', 'col border border-success border-top-0 border-start-1 border-bottom-0 border-end-0 p-1')
                    //     .appendTo('#divValNutIng' + i + 'ing');
                    // }
                    // Tabella valori nutrizionali
                    if(!$('#tableValNut' + i + 'ing').length){
                        nutTab = $('<table/>')
                        .attr('id','tableValNut' + i + 'ing')
                        .attr('class', 'table')
                        .appendTo('#divValNutIng' + i + 'ing');
                    }
                    
                    $('<thead/>').attr('id','tableHeadValNut' + i + 'ing').appendTo('#tableValNut' + i + 'ing');
                    $('<tr/>').attr('id','trHeadValNut' + i + 'ing').appendTo('#tableHeadValNut' + i + 'ing');
                    $('<th/>').attr('scope', 'col').text('Valore Nut.').appendTo('#trHeadValNut' + i + 'ing');
                    $('<th/>').attr('scope', 'col').text('Quant.').appendTo('#trHeadValNut' + i + 'ing');
                    // $('<th/>').attr('scope', 'col').text('%').appendTo('#trHeadValNut' + i + 'ing');
                    $('<tbody/>').attr('id','tableBodyValNut' + i + 'ing').appendTo('#tableValNut' + i + 'ing');
    
                    // servings = data[i].recipe.yield;
                    valNut = data[i].food.nutrients;
                    // daily = data[i].recipe.totalDaily;
    
                    keys = ['ENERC_KCAL','PROCNT', 'FAT', 'CHOCDF', 'FIBTG'];
                    // keysDaily = ['ENERC_KCAL', 'FAT', 'CHOCDF', 'FIBTG', 'PROCNT', 'CHOLE', 'NA'];
                    filNutrients = keys.map(key => valNut[key]).filter(v => v);
                    // filNutrientsDaily = keysDaily.map(key => daily[key]).filter(v => v);
                    // console.log(filNutrients[0].label);
    
                    for(h=0; h<filNutrients.length; h++){
                        $('<tr/>').attr('id','trHeadValNut' + i + 'ing' + h).appendTo('#tableBodyValNut' + i + 'ing');
                        $('<td/>').attr('scope', 'row').text(keys[h]).appendTo('#trHeadValNut' + i + 'ing' + h);
                        filNut = $('<td/>').text(Math.round(filNutrients[h])).appendTo('#trHeadValNut' + i + 'ing' + h);
                        if(h > 0) filNut.text(filNut.html() + ' ' + 'g');
                    }
    
                    // if(!$('#ULIngredienti' + i + 'ing').length){
                    //     ulIng = $('<ul/>')
                    //     .attr('class','list-group')
                    //     .attr('id', 'ULIngredienti' + i + 'ing')
                    //     .appendTo('#divIng' + i + 'ing');
                    // }
    
                    // let ing = data[i].recipe.ingredients;
                    // // Crea Li ingrediente con nome e checkbox
                    // for(j=0; j<ing.length; j++){
                    //     if(!$('#liIngrediente' + i + 'ing' + '' + j).length){
                    //         liIng = $('<li/>')
                    //         .attr('class', 'list-group-item d-flex')
                    //         .attr('id', 'liIngrediente' + i + 'ing' + '' + j)
                    //         .appendTo('#ULIngredienti' + i + 'ing');
                    //     }
    
                    //     if(!$('#divIng' + i + 'ing' + '' + j).length){
                    //         divSpIng = $('<div/>')
                    //         .attr('id', 'divIng' + i + 'ing' + '' + j)
                    //         .attr('class', 'flex-fill')
                    //         .text(ing[j].food)
                    //         .appendTo('#liIngrediente' + i + 'ing' + '' + j)
                    //     }
                    //     if(!$('#inputIngCheckBox' + i + 'ing' + '' + j).length){
                    //         checkboxIng = $('<input/>')
                    //         .attr('class', 'form-check-input me-1 checkboxIng')
                    //         .attr('id', 'inputIngCheckBox' + i + 'ing' + '' + j)
                    //         .attr('type', 'checkbox')
                    //         .appendTo('#liIngrediente' + i + 'ing' + '' + j)
                    //     }
                    // }
                }
            });
        }
    })
    $('#calendarBtn').click(e => {
        e.preventDefault();

        let dataRecipes = {
            'Recipes': {},
            'Ing': []
        }

        listRecipesChildRecipes = $('#listRecipes').children("[id^='divRecipe']");

        let ingRecipeNames = new Array();
        listRecipesChildRecipes.each(function(){
            // Nome ricetta
            let recipeName = $(this).children().children().children().children("[id^='divNameRecipe']").children("h4").html();
            // Nomi ingredienti
            let ingNames = $(this).children().children("[id^='recipeIngDiv']").children().siblings();
            ingNames.each(function(){
                console.log($(this).attr('id'));
                if(!ingRecipeNames.includes($(this).html())) ingRecipeNames.push($(this).html());
            })

            // Aggiunge la ricetta al file JSON
            dataRecipes.Recipes[recipeName] = ingRecipeNames;
            // Reset array
            ingRecipeNames = [];
        })
        
        // Aggiunge tutti gli ingredienti singoli
        listRecipesChildIng = $('#listRecipes').children("[id^='divIng']");
        listRecipesChildIng.each(function(){
            let ingName = $(this).children("[id^='divIng']").children("[id^='divNameValNut']").children("h4").html();
            dataRecipes['Ing'].push(ingName);
        })

        // Invio sotto forma di stringa il file JSON a server.js cosi da salvarlo su calendar
        axiosAddEventCalendar(JSON.stringify(dataRecipes))
        .then(authUrl => {
            // console.log(res);
            console.log(authUrl);
            // // Spawn modal per autorizzazione google e creazione token
            if(authUrl){
                $('#authUrlModal').modal('toggle');
                $('#authUrlSpace').attr('href', authUrl);
            }else{
                console.log(`authUrl -> ${authUrl}`);
            }
        });
    });

    // Buttons per conferma ricetta e ingredienti
    $('#okModalBtnRecipe').click(() => {
        // console.log($("[id^='liIngrediente'] input:checked").prop('id'));
        let ingredients = [];
        let checkedBox = $("[id^='inputRecipeIngCheckBox']:checked");
        checkedBox.each(function(){
            ingredients.push($(this).prev().html());
        })

        // console.log(ingredients);

        // Da sistemare
        if(ingredients.length){
            let recipe = checkedBox.parents("[id^='divDrop']").prev().html();
            let imgRecipeLink = imgRecipe[checkedBox.parents("[id^='divDrop']").prev().attr('nrecipe')];
            let selfLink = checkedBox.parents("[id^='divDrop']").prev().attr('reflink');

            currentRecipes = $("[id^='divRecipe']");
            let foundDiv = false;
            let thisCountRecipe = 0;

            currentRecipes.each(function(){
                if($(this).attr('hash') == recipe.hashCode()){
                    foundDiv = true;
                    for(h=0; h<ingredients.length; h++){
                        $('<div/>').attr('id', 'ingDiv' + thisCountRecipe + 'a' + h).attr('class', 'list-group-item').text(ingredients[h]).appendTo('#recipeIngDiv' + thisCountRecipe + 'a');
                    }
                } else {
                    // console.log($(this).attr('id'));
                    thisCountRecipe++;
                }
            })

            if(!foundDiv){
                axiosGetSingleRecipe(selfLink, recipe).then(data => {
                    // Check data not null
                    if(data){
                        // Array con stringhe di ingredienti
                        ingredienti = data.ingredientLines;
                        persone = data.yield;

                        kcal = Math.round(data.calories / persone);
                        // Main Nutrients Val.
                        fat = Math.round(data.totalNutrients.FAT.quantity);
                        carbo = Math.round(data.totalNutrients.CHOCDF.quantity);
                        protein = Math.round(data.totalNutrients.PROCNT.quantity);
                        // Others Nutrients Val.
                        cholesterole = Math.round(data.totalNutrients.CHOLE.quantity);
                        sodium = Math.round(data.totalNutrients.NA.quantity);
                        calcium = Math.round(data.totalNutrients.CA.quantity);
                        magnesium = Math.round(data.totalNutrients.MG.quantity);
                        potassium = Math.round(data.totalNutrients.K.quantity);
                        iron = Math.round(data.totalNutrients.FE.quantity);

                        $('<p/>').attr('class', 'h4').text(servings + ' Servings').appendTo('#divKcal' + countRecipe + 'a');
                        $('<p/>').attr('class', 'h4').text(kcal + ' kcal').appendTo('#divKcal' + countRecipe + 'a');

                        $('<p/>').attr('class', 'h5').text('Fat ' + fat + ' g').appendTo('#divMainNut' + countRecipe + 'a');
                        $('<p/>').attr('class', 'h5').text('Carbo. ' + carbo + ' g').appendTo('#divMainNut' + countRecipe + 'a');
                        $('<p/>').attr('class', 'h5').text('Protein ' + protein + ' g').appendTo('#divMainNut' + countRecipe + 'a');

                        $('<p/>').attr('class', 'h5').text('Cholesterole ' + cholesterole + ' mg').appendTo('#divOtherNut' + countRecipe + 'a');
                        $('<p/>').attr('class', 'h5').text('Sodium ' + sodium + ' mg').appendTo('#divOtherNut' + countRecipe + 'a');
                        $('<p/>').attr('class', 'h5').text('Calcium ' + calcium + ' mg').appendTo('#divOtherNut' + countRecipe + 'a');
                        $('<p/>').attr('class', 'h5').text('Magnesium ' + magnesium + ' mg').appendTo('#divOtherNut' + countRecipe + 'a');
                        $('<p/>').attr('class', 'h5').text('Potassium ' + potassium + ' mg').appendTo('#divOtherNut' + countRecipe + 'a');
                        $('<p/>').attr('class', 'h5').text('Iron ' + iron + ' mg').appendTo('#divOtherNut' + countRecipe + 'a');

                        countRecipe++;
                    }
                });

                listGroupDiv = $('#listRecipes');
                $('<div/>').attr('id','divRecipe' + countRecipe + 'a').attr('class', 'container border border-dark mb-2').attr('hash', recipe.hashCode()).appendTo(listGroupDiv);

                $('<div/>').attr('id','divRecipeRow' + countRecipe + 'a').attr('class', 'row').appendTo('#divRecipe' + countRecipe + 'a');
                $('<div/>').attr('id', 'divRecipeCard' + countRecipe + 'a').attr('class', 'col-sm-6 col-md-6 col-lg-6 col-xl-6 container').appendTo('#divRecipeRow' + countRecipe + 'a');
                $('<div/>').attr('id', 'recipeIngDiv' + countRecipe + 'a').attr('class', 'list-group p-3 col-md-6').appendTo('#divRecipeRow' + countRecipe + 'a');

                $('<div/>').attr('id', 'divRecipeRow0' + countRecipe + 'a').attr('class', 'row').appendTo('#divRecipeCard' + countRecipe + 'a');
                $('<div/>').attr('id', 'divImgRecipe' + countRecipe + 'a').attr('class', 'col-sm-6 col-md-6 col-lg-6 col-xl-6 p-2').appendTo('#divRecipeRow0' + countRecipe + 'a');
                $('<img>').attr('src', imgRecipeLink).attr('class', 'card-img-top cardImg').appendTo('#divImgRecipe' + countRecipe + 'a');

                $('<div/>').attr('id', 'divNameRecipe' + countRecipe + 'a').attr('class', 'col-sm-6 col-md-6 col-lg-6 col-xl-6 p-2').appendTo('#divRecipeRow0' + countRecipe + 'a');
                $('<h4/>').attr('class', 'card-title').text(recipe).appendTo('#divNameRecipe' + countRecipe + 'a');

                $('<div/>').attr('id', 'divRecipeRow1' + countRecipe + 'a').attr('class', 'row').appendTo('#divRecipeCard' + countRecipe + 'a');
                $('<div/>').attr('id', 'divNutRecipe' + countRecipe + 'a').attr('class', 'row').appendTo('#divRecipeRow1' + countRecipe + 'a');

                $('<div/>').attr('id', 'divKcal' + countRecipe + 'a').attr('class', 'col-sm-4 col-md-4 col-lg-4 col-xl-4').appendTo('#divRecipeRow1' + countRecipe + 'a');
                $('<div/>').attr('id', 'divMainNut' + countRecipe + 'a').attr('class', 'col-sm-4 col-md-4 col-lg-4 col-xl-4').appendTo('#divRecipeRow1' + countRecipe + 'a');
                $('<div/>').attr('id', 'divOtherNut' + countRecipe + 'a').attr('class', 'col-sm-4 col-md-4 col-lg-4 col-xl-4').appendTo('#divRecipeRow1' + countRecipe + 'a');

                for(h=0; h<ingredients.length; h++){
                    $('<div/>').attr('id', 'ingDiv' + countRecipe + 'a' + h).attr('class', 'list-group-item').text(ingredients[h]).appendTo('#recipeIngDiv' + countRecipe + 'a');
                }
            }
        }

        $('#recipeListDiv').empty();
    })
    $('#okModalBtnIng').click(() => {
        let checkedIng = $("[id^='aIng']");
        let imgIngLink = '';
        let nameIng = '';

        checkedIng.each(function(){
            // console.log($(this).html());
            // console.log($(this).html() + ' - ' + $(this).attr('aria-expanded'));
            if($(this).attr('aria-expanded') === 'true'){
                // console.log('OK -> ' + $(this).html());
                imgIngLink = imgIng[$(this).attr('ning')];
                nameIng = $(this).html();
                console.log('Ingredient name -> ' + nameIng);

                axiosGetSingleIng(nameIng).then(data => {
                    if(data){
                        ingredienti = data.ingredientLines;

                        kcal = Math.round(data.calories);
                        // Main Nutrients Val.
                        fat = Math.round(data.totalNutrients.FAT.quantity);
                        carbo = Math.round(data.totalNutrients.CHOCDF.quantity);
                        protein = Math.round(data.totalNutrients.PROCNT.quantity);
                        // Others Nutrients Val.
                        cholesterole = Math.round(data.totalNutrients.CHOLE.quantity);
                        sodium = Math.round(data.totalNutrients.NA.quantity);
                        calcium = Math.round(data.totalNutrients.CA.quantity);
                        magnesium = Math.round(data.totalNutrients.MG.quantity);
                        potassium = Math.round(data.totalNutrients.K.quantity);
                        iron = Math.round(data.totalNutrients.FE.quantity);

                        $('<p/>').attr('class', 'h6').text('Nutritional Facts Per 100Gr').appendTo('#divKcal' + countIng + 'ing');
                        $('<p/>').attr('class', 'h4').text(kcal + ' kcal').appendTo('#divKcal' + countIng + 'ing');

                        $('<p/>').attr('class', 'h5').text('Fat ' + fat + ' g').appendTo('#divMainNut' + countIng + 'ing');
                        $('<p/>').attr('class', 'h5').text('Carbo. ' + carbo + ' g').appendTo('#divMainNut' + countIng + 'ing');
                        $('<p/>').attr('class', 'h5').text('Protein ' + protein + ' g').appendTo('#divMainNut' + countIng + 'ing');

                        $('<p/>').attr('class', 'h5').text('Cholesterole ' + cholesterole + ' mg').appendTo('#divOtherNut' + countIng + 'ing');
                        $('<p/>').attr('class', 'h5').text('Sodium ' + sodium + ' mg').appendTo('#divOtherNut' + countIng + 'ing');
                        $('<p/>').attr('class', 'h5').text('Calcium ' + calcium + ' mg').appendTo('#divOtherNut' + countIng + 'ing');
                        $('<p/>').attr('class', 'h5').text('Magnesium ' + magnesium + ' mg').appendTo('#divOtherNut' + countIng + 'ing');
                        $('<p/>').attr('class', 'h5').text('Potassium ' + potassium + ' mg').appendTo('#divOtherNut' + countIng + 'ing');
                        $('<p/>').attr('class', 'h5').text('Iron ' + iron + ' mg').appendTo('#divOtherNut' + countIng + 'ing');

                        countIng++;
                    }
                })

                $('<div/>').attr('id', 'divIng' + countIng + 'ing').attr('class', 'container border border-dark mb-2').appendTo('#listRecipes');
                $('<div/>').attr('id', 'divIngRow0' + countIng + 'ing').attr('class', 'row').appendTo('#divIng' + countIng + 'ing');
                
                $('<div/>').attr('id', 'divImageIng' + countIng + 'ing').attr('class', 'col-4 p-2').appendTo('#divIngRow0' + countIng + 'ing');
                $('<img/>').attr('src', imgIngLink).attr('class', 'img-fluid rounded').appendTo('#divImageIng' + countIng + 'ing');

                $('<div/>').attr('id', 'divNameValNutIng' + countIng + 'ing').attr('class', 'col-8 d-flex flex-column').appendTo('#divIngRow0' + countIng + 'ing');
                $('<h4/>').attr('class', 'card-title').text(nameIng).appendTo('#divNameValNutIng' + countIng + 'ing');
                
                $('<div/>').attr('id', 'divValNut' + countIng + 'ing').attr('class', 'row').appendTo('#divNameValNutIng' + countIng + 'ing');
                $('<div/>').attr('id', 'divKcal' + countIng + 'ing').attr('class', 'col-sm-4 col-md-4 col-lg-4 col-xl-4').appendTo('#divValNut' + countIng + 'ing');
                $('<div/>').attr('id', 'divMainNut' + countIng + 'ing').attr('class', 'col-sm-4 col-md-4 col-lg-4 col-xl-4').appendTo('#divValNut' + countIng + 'ing');
                $('<div/>').attr('id', 'divOtherNut' + countIng + 'ing').attr('class', 'col-sm-4 col-md-4 col-lg-4 col-xl-4').appendTo('#divValNut' + countIng + 'ing');

            }
        })

        $('#IngListDiv').empty();
    });

    // Rimuovono le ricette ottenute dalla richiesta quando si chiude il modal
    $('#closeModalRecipesBtn').click(() => {
        $('#recipeListDiv').empty();
    })
    $('#closeModalIngBtn').click(() => {
        $('#IngListDiv').empty();
    })
    $('#closeModalAuthUrlBtn').click(() => {
        $('#authUrlModal').empty();
    })
    
    // Non permette l'uscita dal modal cliccando fuori da quest'ultimo, in questo modo possiamo uscire dal modal
    // soltanto con i tasti X e Scegli, cosi da cancellare quello che c'e dentro il modal
    $('#recipeListModal').modal({
        backdrop: 'static',
        keyboard: false
    });
    $('#ingListModal').modal({
        backdrop: 'static',
        keyboard: false
    });
})