from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("hub", "0003_difficulty_rankings")]
    operations = [
        migrations.RemoveField(model_name="game", name="bgg_weight"),
        migrations.RemoveField(model_name="game", name="bgg_num_weights"),
    ]
