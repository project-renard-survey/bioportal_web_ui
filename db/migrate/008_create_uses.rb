class CreateUses < ActiveRecord::Migration
  def self.up
    create_table :uses do |t|
      t.integer :project_id,:ontology_id
      t.timestamps
    end
  end

  def self.down
    drop_table :uses
  end
end
