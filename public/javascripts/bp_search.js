var resultsTable;

jQuery(document).ready(function(){
  jQuery("#search_button").button();

  resultsTable = jQuery("#search_results").dataTable({
    bPaginate: false,
    bAutoWidth: false,
    aaSorting: [],
    oLanguage: {
      sZeroRecords: "No search results found"
    },
    "aoColumns": [
          { "sWidth": "450px" },
          { "sWidth": "150px" },
          { "sWidth": "325px" }
    ]
  });

});

jQuery(document).ready(function(){
  // Put cursor in search box by default
  jQuery("#search_keywords").focus();

  // Show/hide on refresh
  if (jQuery("#search_select_ontologies").is(":checked")) {
    jQuery("#ontology_picker_options").removeClass("not_visible");
  }

  jQuery("#search_select_ontologies").change(function(){
    if (jQuery(this).is(":checked")) {
      jQuery("#ontology_picker_options").removeClass("not_visible");
    } else {
      jQuery("#ontology_picker_options").addClass("not_visible");
      jQuery("#ontology_ontologyId").val("");
      jQuery("#ontology_ontologyId").trigger("liszt:updated");
    }
  });

  jQuery("#search_button").click(function(event){
    event.preventDefault();

    jQuery("#search_spinner").show();

    var ont_val = jQuery("#ontology_ontologyId").val();

    var onts = (ont_val == null) ? "" : ont_val.join(",");
    var query = jQuery("#search_keywords").val();
    var exactMatch = jQuery("#search_exact_match").is(":checked");
    var includeProps = jQuery("#search_include_props").is(":checked");

    jQuery.ajax({
      url: "/search/json?page_size=99999&ontology_ids="+onts+"&query="+query+"&exact_match="+exactMatch+"&include_props=1",
      dataType: "json",
      async: false,
      success: function(data){
        var results = [];
        var ontologies = {};
        var ontology_links = [];
        var ontologies_for_sort = [];
        var ontologies_sorted = [];
        var max_word_length = 60;

        if (!jQuery.isEmptyObject(data)) {
          jQuery(data.results).each(function(){
            var res = this;
            var additionalSpan = "<span class='additional'><a href='/ajax/term_details/"+res.ontologyId+"?styled=false&conceptid="+encodeURIComponent(res.conceptId)+"' class='term_details' rel='facebox[.term_details_pop]'>details</a> | <a href='javascript:void(0);' data-bp_ontologyid='"+res.ontologyId+"' data-bp_conceptid='"+encodeURIComponent(res.conceptId)+"' class='term_visualize'>visualize</a></span>";

            var elipses = (res.preferredName.length > max_word_length) ? "..." : "";

            // We have to look for a span here, indicating that the term is obsolete.
            // If not, add the term to a new span to match obsolete structure so we can process them the same.
            var label_html = (res.isObsolete == "1") ? jQuery(res.label_html) : jQuery("<span/>").append(res.label_html);
            label_html = jQuery("<span/>").append(label_html.html(label_html.html().substring(0, max_word_length)+elipses));

            var row = [
              "<div class='term_link'>"+additionalSpan+"<a title='"+res.preferredName+"' href='/ontologies/"+res.ontologyId+"?p=terms&conceptid="+encodeURIComponent(res.conceptId)+"'>"+jQuery(label_html).html()+"</a></div>",
              res.recordTypeFormatted,
              "<a href='/ontologies/"+res.ontologyId+"'>"+res.ontologyDisplayLabel+"</a>"
            ];

            // Keep track of how many results are associated with each ontology
            ontologies[res.ontologyDisplayLabel] = (res.ontologyDisplayLabel in ontologies) ? ontologies[res.ontologyDisplayLabel] + 1 : 1;

            results.push(row);
          });
        }

        jQuery.each(ontologies, function(k, v){
            ontologies_for_sort.push({label: k + " (" + v + ")", count: v, value: k, value_encoded: encodeURIComponent(k)});
        });

        ontologies_for_sort.sort(function(a, b){return a.count < b.count});

        jQuery.each(ontologies_for_sort, function(){
          var checkbox = jQuery("<input/>").attr("class", "filter_ontology_checkboxes").attr("type", "checkbox").attr("value", this.value).attr("id", this.value_encoded);
          var label = jQuery("<label/>").attr("for", this.value_encoded).html(" " + this.label);
          ontologies_sorted.push(jQuery("<span/>").append(checkbox).append(label).html());
        });

        jQuery("#ontology_filter_list").html(ontologies_sorted.join("<br/>"));

        resultsTable.fnClearTable();
        resultsTable.fnSortNeutral();
        removeFilters();
        resultsTable.fnAddData(results);

        // Re-bind click event for ont filter to avoid weird "live" propagation issues
        filter_ontologies.init();

        jQuery("a[rel*=facebox]").facebox();

        // Align search results div
        var result_count = jQuery("#result_stats");

        if (data.current_page_results < 100) {
          result_count.html(data.current_page_results + " results");
        } else {
          result_count.html("Top " + data.current_page_results + " of " + data.total_hits + " results");
        }


        // jQuery("table#search_results div.term_link").hover(termHoverIn, termHoverOut);
        jQuery("table#search_results").show();
      }
    });

    jQuery("#search_spinner").hide();
  });

  // Search on enter
  jQuery("#search_keywords").bind("keyup", function(event){
    if (event.which == 13) {
      jQuery("#search_button").click();
    }
  });

  // Details/visualze link to show details pane and visualize flexviz
  jQuery.facebox.settings.closeImage = '/javascripts/JqueryPlugins/facebox/closelabel.png';
  jQuery.facebox.settings.loadingImage = '/javascripts/JqueryPlugins/facebox/loading.gif';

  // Position of popup for details
  jQuery(document).bind('reveal.facebox', function(){
    if (jQuery("div.term_details_pop").is(":visible")) {
      jQuery("div.term_details_pop").css("max-height", jQuery(window).height() - jQuery("div.term_details_pop").offset().top * 2 + "px");
    }
  });

  // Use pop-up with flex via an iframe for "visualize" link
  jQuery("a.term_visualize").live("click", (function(){
    var ontologyid = jQuery(this).attr("data-bp_ontologyid");
    var conceptid = jQuery(this).attr("data-bp_conceptid");

    jQuery("#flexviz").html('<iframe src="/flexviz/'+ontologyid+'?conceptid='+conceptid+'" frameborder=0 height="500px" width="500px" scrolling="no"></iframe>').show();
    jQuery.facebox({ div: '#flexviz' });
  }));

  // Check for existing parameters/queries and update UI accordingly
  var params = jQuery.QueryString;
  if ("q" in params || "query" in params) {
    var query = ("q" in params) ? params["q"] : params["query"];
    jQuery("#search_keywords").val(query);

    if (params["exactmatch"] == "true") {
      jQuery("#search_exact_match").click();
    }

    if (params["searchproperties"] == "true") {
      jQuery("#search_include_props").click();
    }

    if ("ontologyids" in params) {
      var ontologyIds = params["ontologyids"].split(",");
      jQuery("#search_select_ontologies").attr("checked", false)
      jQuery("#ontology_ontologyId").val(ontologyIds);
      jQuery("#ontology_ontologyId").trigger("liszt:updated");
      jQuery("#search_select_ontologies").click().change();
    }

    jQuery("#search_button").click();
  } else if (jQuery("#search_keywords").val() != "") {
    jQuery("#search_button").click();
  }

  // Wire up pop-ups
  filter_ontologies.init();
  filter_matched.init();
});

// Datatables reset sort extension
jQuery.fn.dataTableExt.oApi.fnSortNeutral = function ( oSettings ) {
  /* Remove any current sorting */
  oSettings.aaSorting = [];

  /* Sort display arrays so we get them in numerical order */
  oSettings.aiDisplay.sort( function (x,y) {
    return x-y;
  } );
  oSettings.aiDisplayMaster.sort( function (x,y) {
    return x-y;
  } );

  /* Redraw */
  oSettings.oApi._fnReDraw( oSettings );
}

var termHoverIn = function(){
var additional = jQuery(this).children("span.additional");
additional.show();
additional.css("margin-top", jQuery(this).innerHeight() / 2 - additional.innerHeight() / 2 + "px");
}

var termHoverOut = function(){
jQuery(this).children("span.additional").hide();
}


var removeFilters = function() {
jQuery(".filter_ontology_checkboxes").attr("checked", false);
jQuery(".filter_matched_checkboxes").attr("checked", false);
resultsTable.fnFilter("", 1);
resultsTable.fnFilter("", 2);
jQuery("#search_filter_list").hide();
}

var displayFilteredColumnNames = function() {
var column_names = [];
jQuery(".bp_popup_list input:checked").closest("th").each(function(){
  column_names.push(jQuery(this).attr("title"));
});
jQuery("#search_filter_names").html(column_names.join(", "))
if (column_names.length > 0) {
  jQuery("#search_filter_list").show();
} else {
  jQuery("#search_filter_list").hide();
}
}

var filter_ontologies = {
init: function() {
  jQuery("#filter_ontologies").bind("click", function(e){bp_popup_init(e)});
  jQuery(".filter_ontology_checkboxes").bind("click", function(e){filter_ontologies.filterOntology(e)});
  jQuery("#ontology_filter_list").click(function(e){e.stopPropagation()});
  this.cleanup();
},

cleanup: function() {
  jQuery("html").click(bp_popup_cleanup);
  jQuery(document).keyup(function(e) {
    if (e.keyCode == 27) { bp_popup_cleanup(); } // esc
  });
},

filterOntology: function(e) {
  e.stopPropagation();

  var search_regex = [];
  jQuery(".filter_ontology_checkboxes:checked").each(function(){
    search_regex.push(jQuery(this).val());
  });

  if (search_regex.length == 0) {
    resultsTable.fnFilter("", 2);
  } else {
    resultsTable.fnFilter(search_regex.join("|"), 2, true, false);
  }

  displayFilteredColumnNames();

  jQuery("#result_stats").html(jQuery(resultsTable).find("tr").length - 1 + " results");
}
}

var filter_matched = {
init: function() {
  jQuery("#filter_matched").bind("click", function(e){bp_popup_init(e)});
  jQuery(".filter_matched_checkboxes").bind("click", function(e){filter_matched.filterMatched(e)});
  jQuery("#matched_filter_list").click(function(e){e.stopPropagation()});
  this.cleanup();
},

cleanup: function() {
  jQuery("html").click(bp_popup_cleanup);
  jQuery(document).keyup(function(e) {
    if (e.keyCode == 27) { bp_popup_cleanup(); } // esc
  });
},

filterMatched: function(e) {
  e.stopPropagation();

  var search_regex = [];
  jQuery(".filter_matched_checkboxes:checked").each(function(){
    search_regex.push(jQuery(this).val());
  });

  if (search_regex.length == 0) {
    resultsTable.fnFilter("", 1);
  } else {
    resultsTable.fnFilter(search_regex.join("|"), 1, true, false);
  }

  displayFilteredColumnNames();

  jQuery("#result_stats").html(jQuery(resultsTable).find("tr").length - 1 + " results");
}
}

