class AnnotatorController < ApplicationController
  layout 'ontology'

  ANNOTATOR = NCBO::Annotator.new(:apikey => $API_KEY, :annotator_location => "http://#{$REST_DOMAIN}/obs")

  def index
    ontologies = ANNOTATOR.ontologies
    ontology_ids = []
    ontologies.each {|ont| ontology_ids << ont[:virtualOntologyId]}

    semantic_types = ANNOTATOR.semantic_types
    @semantic_types_for_select = []
    semantic_types.each do |semantic_type|
      @semantic_types_for_select << [ "#{semantic_type[:description]} (#{semantic_type[:semanticType]})", semantic_type[:semanticType]]
    end
    @semantic_types_for_select.sort! {|a,b| a[0] <=> b[0]}

    @annotator_ontologies = DataAccess.getFilteredOntologyList(ontology_ids)
  end

  def create
    text = params[:text].strip

    options = { :ontologiesToKeepInResult => params[:ontology_ids] ||= [],
                :withDefaultStopWords => true,
                :levelMax => params[:levelMax] ||= 1,
                :semanticTypes => params[:semanticTypes] ||= [],
                :mappingTypes => params[:mappingTypes] ||= [],
                :wholeWordOnly => params[:wholeWordOnly] ||= true
    }

    # Add "My BioPortal" ontologies to the ontologies to keep in result parameter
    OntologyFilter.pre(:annotator, options)

   # Make sure that custom ontologies exist in the annotator ontology set
    if session[:user_ontologies]
      annotator_ontologies = Set.new([])
      ANNOTATOR.ontologies.each {|ont| annotator_ontologies << ont[:virtualOntologyId]}
      options[:ontologiesToKeepInResult] = options[:ontologiesToKeepInResult].split(",") if options[:ontologiesToKeepInResult].kind_of?(String)
      options[:ontologiesToKeepInResult].reject! {|a| !annotator_ontologies.include?(a)}
    end

    start = Time.now
    annotations = ANNOTATOR.annotate(text, options)
    LOG.add :debug, "Getting annotations: #{Time.now - start}s"

    highlight_cache = {}

    start = Time.now
    annotations.annotations.each do |annotation|
      if highlight_cache.key?([annotation[:context][:from], annotation[:context][:to]])
        annotation[:context][:highlight] = highlight_cache[[annotation[:context][:from], annotation[:context][:to]]]
      else
        annotation[:context][:highlight] = highlight_and_get_context(text, [annotation[:context][:from], annotation[:context][:to]])
        highlight_cache[[annotation[:context][:from], annotation[:context][:to]]] = annotation[:context][:highlight]
      end
    end
    annotations.statistics[:parameters] = { :textToAnnotate => text, :apikey => $API_KEY }.merge(options)
    # annotations.annotations.sort! {|a,b| b[:score] <=> a[:score]}
    LOG.add :debug, "Processing annotations: #{Time.now - start}s"

    ontologies_hash = {}
    annotations.ontologies.each do |ont|
      ontologies_hash[ont[:localOntologyId]] = ont
    end
    annotations.ontologies = ontologies_hash

    render :json => annotations
  end

private

  def highlight_and_get_context(text, position, words_to_keep = 4)
    # Process the highlighted text
    highlight = ["<span style='color: #006600; padding: 2px 0; font-weight: bold;'>", "", "</span>"]
    highlight[1] = text.utf8_slice(position[0] - 1, position[1] - position[0] + 1)

    # Use scan to split the text on spaces while keeping the spaces
    scan_filter = Regexp.new(/[ ]+?[-\?'"\+\.,]+\w+|[ ]+?[-\?'"\+\.,]+\w+[-\?'"\+\.,]|\w+[-\?'"\+\.,]+|[ ]+?\w+/)
    before = text.utf8_slice(0, position[0] - 1).match(/(\s+\S+|\S+\s+){0,4}$/).to_s
    after = text.utf8_slice(position[1], ActiveSupport::Multibyte::Chars.new(text).length - position[1]).match(/^(\S+\s+\S+|\s+\S+|\S+\s+){0,4}/).to_s

    # The process above will not keep a space right before the highlighted word, so let's keep it here if needed
    # 32 is the character code for space
    kept_space = text.utf8_slice(position[0] - 2) == " " ? " " : ""

    # Put it all together
    [before, kept_space, highlight.join, after].join
  end
end